# Production deployment

`docker-compose.yml` is for local development: one backend, published database ports, and demo defaults.
`docker-compose.prod.yml` runs the same app as a multi-container deployment behind one entry point.

## Topology

```
                         ┌────────────────────────────────────────────┐
 Internet ── :80 ──────► │ proxy (nginx)                              │
                         │  • serves the built SPA                    │
                         │  • per-IP flood limit (30 r/s, burst 60)   │
                         │  • load-balances /api across replicas      │
                         └──────────────┬─────────────────────────────┘
                                        │ public network
               ┌────────────────────────┼────────────────────────┐
               ▼                        ▼                        ▼
        backend #1 … #N          (not routed)  worker × 1     outbound: LLM APIs,
        FastAPI, uvicorn ×       Telegram poller,             Telegram
        WEB_CONCURRENCY          re-embed loop
               │                        │
               └───────────┬────────────┘ private network (internal: no ingress/egress)
          ┌────────────┬───┴────────┬──────────────┐
          ▼            ▼            ▼              ▼
      postgres       neo4j        redis        ollama (optional profile)
      + pgvector     graph        rate-limit
                                  state
```

| Service   | Replicas | Role |
|-----------|----------|------|
| `proxy`   | 1        | Only published port. SPA, security headers, gzip, asset caching, per-IP flood limit. |
| `backend` | `API_REPLICAS` (default 3) | Stateless API. `RUN_BACKGROUND_TASKS=false`. |
| `worker`  | exactly 1 | Same image with `RUN_BACKGROUND_TASKS=true`: Telegram bot (Telegram allows one poller per token) and background re-embedding. |
| `redis`   | 1        | Shared rate-limit state. Ephemeral by design (no persistence, 128 MB, TTL eviction). |
| `postgres`, `neo4j` | 1 | Data. Named volumes, no published ports. |
| `ollama`  | optional | `--profile ollama` for local models. |

Uploaded documents live in the shared `uploads` volume, so any replica can serve or re-index them.

## First deploy

```bash
cp .env.prod.example .env.prod          # set POSTGRES_PASSWORD, NEO4J_PASSWORD, JWT_SECRET_KEY, PUBLIC_ORIGIN
cp backend/.env.example backend/.env    # LLM provider, model, API keys, TELEGRAM_BOT_TOKEN, rate limits
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
curl http://localhost/api/health        # "rate_limit": "redis" confirms shared limits are active
```

Generate secrets with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Compose refuses to start if a
required secret is missing, and the backend refuses to start in production with the default JWT secret.

Settings in `docker-compose.prod.yml` (`APP_ENV=production`, database URLs, `REDIS_URL`, …) override `backend/.env`.
In production the OpenAPI docs (`/docs`, `/openapi.json`) are disabled.

**Embeddings:** the default `backend/.env` uses Ollama for embeddings. Either run `--profile ollama` and set
`OLLAMA_BASE_URL=http://ollama:11434`, or switch `EMBEDDING_PROVIDER` to a hosted provider. Otherwise the app runs on
its labelled lexical fallback.

## Scaling

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --scale backend=6
```

- Total API processes = `API_REPLICAS × WEB_CONCURRENCY`. Each process holds its own DB connection pool, so keep the
  total within Postgres' `max_connections` (default 100; SQLAlchemy uses up to 15 connections per process).
- nginx re-resolves `backend` via Docker DNS every 10 s, so new or restarted replicas join the rotation automatically.
  Failed idempotent requests are retried once on another replica.
- Never scale `worker` above 1.
- Startup is safe to run concurrently: schema setup and seeding are serialised with a Postgres advisory lock, so the
  first container seeds and the rest wait, then find the data already present.

## Rate limiting

Two layers:

1. **Edge (nginx, per IP):** absorbs floods. 30 req/s with a burst of 60 per client IP, and 40 concurrent connections.
   It's deliberately generous, because many mobile users in India share one carrier-grade NAT address.
2. **Application (per user, shared through Redis):** the real policy. It uses **GCRA** (Generic Cell Rate
   Algorithm), which behaves like a token bucket: a client may burst, then continues at a steady rate. It was chosen
   because:
   - Conversational use is bursty (quick follow-up questions), so a strict fixed rate would frustrate users.
   - Fixed windows allow up to 2× the limit around each window boundary. Sliding logs store every request.
     GCRA stores one timestamp per client, and the whole check is a single atomic Redis Lua call.
   - The script reads Redis' clock, so replicas with skewed clocks still agree.

Clients are keyed by user id when a valid token is present, and otherwise by IP.

| Tier | Applies to | Key | Default (`count/period:burst`) |
|------|-----------|-----|----------------|
| `auth` | `POST /api/auth/{signin,signup,forgot-password,reset-password}` | IP | `20/minute:10` |
| `ai` | `POST /api/assistant/chat`, `/api/kag/query`, screen-assistance sessions and messages | user | `20/minute:8` |
| `upload` | document uploads, admin ingestion and re-embedding | user | `10/minute:5` |
| `default` | every other `/api/*` request (health checks exempt) | user / IP | `180/minute:60` |

A request consumes its specific tier and the default tier. If the specific tier rejects it, the default allowance is
not charged. Rejected requests get `429` with `Retry-After`. All limited responses carry `RateLimit-Limit`,
`RateLimit-Remaining` and `RateLimit-Reset`. Tune the limits with the `RATE_LIMIT_*` settings in `backend/.env`.

If Redis is unreachable, the limiter **fails open**: requests are allowed and a warning is logged every 30 s. The edge
limit still applies. Without `REDIS_URL`, as in the dev compose file, limits are kept per process.

**Client IPs:** backends trust `X-Forwarded-For` only from `FORWARDED_ALLOW_IPS`. The production compose file sets
`*`, which is safe only because the backends are reachable solely through the proxy. If you add another load balancer
in front, make sure it overwrites (not appends to) `X-Forwarded-For`, or set `real_ip_header` in nginx.

## TLS

Terminate TLS in front of the proxy (cloud load balancer, Caddy, or Traefik), or add a `listen 443 ssl` server to
`frontend/nginx.conf` with certificates mounted read-only. Then set `PUBLIC_ORIGIN=https://…`. Screen sharing
(`getDisplayMedia`) and the microphone only work over HTTPS, except on `localhost`.

## Operations

```bash
C="docker compose -f docker-compose.prod.yml --env-file .env.prod"
$C logs -f backend worker                # logs rotate at 10 MB × 5 files per container
$C up -d --build backend worker proxy    # deploy a new version (data services untouched)
$C exec postgres pg_dump -U postgres public_service_ai | gzip > backup-$(date +%F).sql.gz
$C exec neo4j neo4j-admin database dump neo4j --to-stdout > neo4j-$(date +%F).dump   # stop neo4j first on Community
```

Back up the `pgdata`, `neo4jdata` and `uploads` volumes. Redis holds only rate-limit counters and needs no backup.

Resource limits (CPU and memory per container) are set in the compose file. Raise `neo4j` and `postgres` memory for
larger knowledge bases.

## Known limitations

- Ingestion jobs run as in-process background tasks on the replica that received the request. They survive only as
  long as that container. A dedicated job queue is the next step if ingestion volume grows.
- Single Postgres, Neo4j and Redis instances. Use managed services or replicas for high availability.
- On Linux hosts using the dev compose file, the backend runs as UID 1000, so `./data/uploads` must be writable by
  that user.
