# Sentry: getting the dashboard

This guide takes you from nothing to a working Sentry dashboard for Sahayak: an account, two projects, the DSNs, where each one goes, how to prove it works, and how to read what shows up.

Sentry is **optional and off by default**. With no DSN set, the backend never imports the SDK and the browser never downloads it, so nothing is sent anywhere.

## What you get

| Dashboard area | What Sahayak sends to it |
|---|---|
| **Issues** | Unhandled backend exceptions and `log.exception()` / error-level logs; browser crashes (React render errors, unhandled rejections); server faults (5xx) seen by the browser, grouped by endpoint |
| **Traces / Performance** | A small sample of requests, one trace from the browser through the API. Health checks are never traced |
| **Releases** | Errors tied to the deployed version, when you set `RELEASE` (git SHA) |
| **Alerts** | Whatever rules you create on the above (see [Alerts](#alerts-worth-setting-up)) |

Every event carries these tags, which you can filter and group by:

| Tag | Meaning |
|---|---|
| `environment` | `development` or `production` |
| `release` | The deployed version, if set |
| `server_name` | Which backend replica raised it (container hostname, or `SENTRY_SERVER_NAME`) |
| `role` | `USER`, `ADMIN` or `anonymous`: the signed-in role, never a name or email |
| `api.route`, `api.status` | Browser-reported server faults, e.g. `POST /api/forms/:id/generate` and `500` |

Signed-in users appear only as an **opaque id**.

---

## 1. Create the Sentry account and projects

1. Go to <https://sentry.io> and sign up (a free plan is enough to try this). When asked, pick the **data region** you want your events stored in. It can't be changed later.
2. Create an **organization** (for example, your team name).
3. Create **two projects**, because the backend and the browser report to separate projects:

   | Project | Platform to choose | Reports |
   |---|---|---|
   | `sahayak-backend` | **Python** (FastAPI is fine) | The API and the background worker |
   | `sahayak-frontend` | **Browser JavaScript** (React is fine) | The web app in users' browsers |

   Choose any alert defaults you like; you can change them later. Skip the SDK install steps Sentry shows: the code is already integrated.

4. Copy each project's **DSN**. It looks like `https://<key>@<host>/<project-id>`; the host depends on your region. You can see it right after creating the project, and any time in **Settings → Projects → (project) → Client Keys (DSN)**.

You now have two DSNs: a **backend DSN** and a **frontend DSN**.

> Self-hosting Sentry instead? The setup here is identical; only the DSN's host differs, because it points at your own Sentry server. Follow Sentry's own self-hosted install guide, then create the same two projects.

---

## 2. Put the DSNs where the app reads them

The two DSNs go in different places, and the frontend one is read at **build time**.

### Docker Compose (development)

| DSN | File | Variable |
|---|---|---|
| Backend | `backend/.env` (copy from `backend/.env.example`) | `SENTRY_DSN=` |
| Frontend | `.env` in the project root (copy from `.env.example`) | `FRONTEND_SENTRY_DSN=` |

```bash
cp backend/.env.example backend/.env     # if you have not already
cp .env.example .env                     # only needed for FRONTEND_SENTRY_DSN
# edit both files and paste the DSNs
docker compose up -d --build backend frontend
```

The frontend must be **rebuilt** whenever `FRONTEND_SENTRY_DSN` changes, because Vite bakes it into the bundle. The backend only needs a restart to pick up `backend/.env` changes.

### Production

Everything lives in `.env.prod` (copy from `.env.prod.example`):

```bash
SENTRY_DSN=<backend DSN>
FRONTEND_SENTRY_DSN=<frontend DSN>
SENTRY_TRACES_SAMPLE_RATE=0.02
RELEASE=<git SHA of what you are deploying>
```

Set `RELEASE` to the commit you are deploying so errors are tied to a version, then deploy. In production the frontend is built into the `proxy` service:

```bash
sed -i "s/^RELEASE=.*/RELEASE=$(git rev-parse --short HEAD)/" .env.prod
C="docker compose -f docker-compose.prod.yml --env-file .env.prod"
$C up -d --build backend worker proxy     # backend + worker report errors; proxy carries the frontend bundle
```

The production compose file sets the environment to `production` for you.

### Local development without Docker

| Part | Where | Variable |
|---|---|---|
| Backend | `backend/.env` | `SENTRY_DSN=` |
| Frontend | `frontend/.env` (copy from `frontend/.env.example`) | `VITE_SENTRY_DSN=` |

Restart `uvicorn` and `npm run dev` after editing.

### All settings

| Variable | Read by | Default | Notes |
|---|---|---|---|
| `SENTRY_DSN` | backend | empty (off) | Python project DSN |
| `SENTRY_ENVIRONMENT` | backend | `APP_ENV` | Production compose sets `production` |
| `SENTRY_RELEASE` / `RELEASE` | backend and frontend build | none | In production, set `RELEASE` once and both sides use it |
| `SENTRY_SERVER_NAME` | backend | container hostname | Tells replicas apart |
| `SENTRY_TRACES_SAMPLE_RATE` | backend (and the frontend build in production) | `0.05` dev, `0.02` production | Fraction of requests traced |
| `SENTRY_PROFILES_SAMPLE_RATE` | backend | `0.0` (off) | Profiling |
| `FRONTEND_SENTRY_DSN` | Compose build arg → `VITE_SENTRY_DSN` | empty (off) | Browser project DSN |
| `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE`, `VITE_SENTRY_TRACES_SAMPLE_RATE` | frontend build | dev/prod set by compose; frontend rate `0.02` | Browser equivalents |

---

## 3. Check that it works

### Backend

1. The startup log should contain a line like `Sentry enabled (env=development, traces=0.05)`:

   ```bash
   docker compose logs backend | grep "Sentry enabled"
   ```

2. Send a test event. This runs the app's own setup, so it also exercises the privacy filters:

   ```bash
   docker compose exec backend python -c "
   from app.monitoring import init_sentry
   import sentry_sdk
   print('enabled:', init_sentry())
   sentry_sdk.capture_message('Sentry backend test', level='error')
   sentry_sdk.flush(5)"
   ```

   In production use `$C exec backend python -c "..."` with the `C=` variable from above. `enabled: False` means `SENTRY_DSN` is empty or was not picked up.

3. In the **sahayak-backend** project, open **Issues**. "Sentry backend test" should appear within a minute.

### Frontend

1. Open the app in a browser after rebuilding the frontend with `FRONTEND_SENTRY_DSN` set.
2. Open DevTools → **Console** and throw an error from a timer, which reaches the browser's global error handler:

   ```js
   setTimeout(() => { throw new Error("Sentry frontend test") })
   ```

3. In DevTools → **Network** you should see a request to your DSN's host (it ends in `sentry.io`). In the **sahayak-frontend** project, open **Issues**: "Sentry frontend test" appears within a minute.

If you see no request at all, see [Troubleshooting](#troubleshooting).

---

## 4. Using the dashboard

**Issues** is where you will spend most time. Identical failures are grouped into one issue with a count, first/last seen, and affected release. Useful searches:

| Goal | Search |
|---|---|
| Open production problems | `is:unresolved environment:production` |
| Only one deployed version | `release:<git-sha>` |
| One sick replica | `server_name:<container-name>` |
| Errors hitting admins | `role:ADMIN` |
| Failing API endpoints seen by users | `api.status:500` |
| One endpoint | `api.route:"POST /api/forms/:id/generate"` |

Browser-reported API failures are grouped **per method, route and status**, with record ids replaced by `:id`, so one broken endpoint is one issue however many records it affects.

**Traces / Performance** (the menu name varies by Sentry version) shows the sampled requests. A trace starts in the browser and continues into the API, so you can see where time went. Backend transactions are named by route, never by URL with ids. Traces are **sampled**, so a quiet page may have none. Raise the sample rate briefly if you need more data.

**Releases** lists each `RELEASE` you deployed and which new issues appeared in it, which is how you spot a bad deploy.

Invite teammates under **Settings → Members**.

---

## Alerts worth setting up

Create these per project under **Alerts → Create Alert**:

1. **New issue in production**: notify by email or Slack when a never-seen error appears in `environment:production`.
2. **Error spike**: notify when a single issue occurs more than a set number of times in an hour (start around 10 and tune it).
3. **Regression**: notify when an issue marked resolved comes back.

Client mistakes (4xx) and rate limiting are not reported, so alerts should stay meaningful.

---

## What is and isn't sent

Sahayak handles identity documents, so the integration is built to keep them out.

**Never sent:** request or response bodies, headers, cookies, query strings, or local variables from stack frames. URLs are cut at the `?`. No session replay. Clicks, typed text and console output are not recorded as breadcrumbs.

**Redacted from messages and breadcrumbs, in both API and browser:** Aadhaar-style 12-digit numbers, phone numbers, email addresses and bearer tokens.

**Identity:** only an opaque user id and a role tag.

**Deliberately ignored:**
- Backend: 4xx client errors and rate limits, plus noisy loggers (`ratelimit`, `uvicorn.access`, `httpx`, `httpcore`).
- Browser: offline or aborted requests ("Failed to fetch", "Load failed", `AbortError`), `ResizeObserver` noise, and errors from browser extensions. Only 5xx API responses are reported.

The code is in `backend/app/monitoring.py` and `frontend/src/monitoring.ts`.

---

## Cost and sampling

Sentry's cost grows with traffic. The defaults are deliberately low:

- Errors are always sent, but identical ones are grouped.
- Traces: `0.05` (5%) for the backend in development, `0.02` (2%) in production and for the browser.
- The **browser decides** whether a request is traced and the API follows that choice, so a trace is complete or absent, never half. Requests that carry no browser trace header (for example the WhatsApp webhook, or `curl`) use the backend's own rate. The Telegram bot polls Telegram instead of receiving HTTP requests, so it isn't traced.
- Profiling is off.

Keep `SENTRY_TRACES_SAMPLE_RATE` between 0.01 and 0.05 unless you are debugging.

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Backend log has no `Sentry enabled` line | `SENTRY_DSN` is empty, or `backend/.env` was edited but the backend wasn't restarted |
| Test command prints `enabled: False` | Same as above; the container isn't seeing the DSN |
| Backend events go to the wrong project | The frontend DSN was pasted into `SENTRY_DSN` (or the reverse). Each project has its own DSN |
| No browser request to your DSN's host | `FRONTEND_SENTRY_DSN` was set after the build. Rebuild the frontend: the DSN is baked in |
| Browser events missing for some users | An ad blocker or privacy extension can block the request. The app is unaffected; that user just isn't monitored |
| Test error doesn't appear | Wait a minute and refresh. Then check the project's **Settings → Inbound Filters** and quota, and make sure you're looking at the right environment |
| Traces are sparse | They are sampled at 2–5%. That's expected |
| Browser stack traces look like `index-abc123.js:1:48211` | Expected for now. See below |

### Known limitation: minified browser stack traces

The production frontend build does not generate or upload **source maps**, so browser stack traces show minified code rather than your original files. Backend traces are unaffected. To fix it later you would enable `build.sourcemap` in `frontend/vite.config.ts` and upload the maps to Sentry at build time (Sentry's Vite plugin does this, using an auth token kept as a build secret). Nothing in this repo does that yet.

---

## Turning it off

Empty `SENTRY_DSN` and `FRONTEND_SENTRY_DSN`, restart the backend and rebuild the frontend. With the DSNs empty the SDKs are neither loaded nor downloaded.

---

## Where things are

| File | Purpose |
|---|---|
| `backend/app/monitoring.py` | Backend setup, privacy filters, sampling |
| `frontend/src/monitoring.ts` | Browser setup, privacy filters, API-failure reporting |
| `frontend/src/components/ErrorBoundary.tsx` | Catches React render errors and reports them |
| `backend/app/config.py` | The `SENTRY_*` settings and defaults |
| `docker-compose.yml`, `docker-compose.prod.yml`, `frontend/Dockerfile` | How the variables reach the backend and the frontend build |
| `.env.example`, `backend/.env.example`, `.env.prod.example`, `frontend/.env.example` | Annotated examples |
| `README.md` → *Monitoring with Sentry* | Short summary |
