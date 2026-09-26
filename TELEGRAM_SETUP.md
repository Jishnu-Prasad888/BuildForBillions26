# Sahayak Telegram Bot — Setup Guide

This guide walks you through getting the Telegram bot running end-to-end, from creating the bot on Telegram to sending your first message.

---

## Prerequisites

- Docker and Docker Compose installed
- A Telegram account
- The project cloned locally (`git clone …`)

---

## Step 1 — Create your Telegram bot

1. Open Telegram and search for **@BotFather** (the official Telegram bot for managing bots).
2. Start a conversation and send:
   ```
   /newbot
   ```
3. BotFather will ask for a **name** (display name, e.g. `Sahayak Assistant`) and a **username** (must end in `bot`, e.g. `sahayak_demo_bot`).
4. After you confirm, BotFather replies with a **token** that looks like:
   ```
   1234567890:ABCDefGhIJKlmNoPQRsTUVwxyZ
   ```
   **Copy this token — you will need it in the next step.**

> Keep the token secret. Anyone with it can control your bot.

---

## Step 2 — Configure the environment

Copy the example environment file:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` in a text editor and set the bot token:

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCDefGhIJKlmNoPQRsTUVwxyZ
```

The rest of the defaults work out of the box for a local Docker Compose run. Key settings you may want to review:

| Variable | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | `ollama` \| `openai` \| `kimi` |
| `LLM_MODEL` | `qwen3:8b` | Any model available in your provider |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Use `http://host.docker.internal:11434` if Ollama runs on your host |
| `OPENAI_API_KEY` | *(empty)* | Required if `LLM_PROVIDER=openai` |
| `KIMI_API_KEY` | *(empty)* | Required if `LLM_PROVIDER=kimi` |

If you leave `TELEGRAM_BOT_TOKEN` empty the bot is silently disabled and the API + web app still run normally.

---

## Step 3 — Start the stack

```bash
docker compose up --build
```

This starts:

| Container | What it does |
|---|---|
| `postgres` | PostgreSQL 16 + pgvector |
| `neo4j` | Neo4j 5 (scheme knowledge graph) |
| `ollama` | Local LLM / embedding server |
| `ollama-pull` | One-shot: pulls the models named in `.env` |
| `backend` | FastAPI API **+ Telegram bot polling** |
| `frontend` | React web app |

The Telegram bot starts automatically inside the `backend` container once the database is healthy. Watch the logs:

```
docker compose logs -f backend
```

You should see a line like:

```
INFO bot: Telegram bot polling started (@sahayak_demo_bot)
```

If you see an error like `Invalid token` or `Unauthorized`, re-check the token in `backend/.env`.

---

## Step 4 — Pull LLM models (first run only)

The `ollama-pull` container pulls models automatically. You can also pull them manually:

```bash
# Embedding model (required for document retrieval)
docker compose exec ollama ollama pull nomic-embed-text

# LLM (for generating answers)
docker compose exec ollama ollama pull qwen3:8b
```

The app works immediately even before the models finish downloading. Until then it uses a deterministic fallback (labelled clearly in answers). Once the embedding model is ready, the backend re-embeds all chunks automatically.

Faster / smaller alternatives if `qwen3:8b` is too slow on your machine:

```bash
docker compose exec ollama ollama pull qwen2.5:3b   # then set LLM_MODEL=qwen2.5:3b in .env
```

---

## Step 5 — Talk to the bot

Open Telegram, search for your bot's username, and tap **Start** or send `/start`.

```
/start
```

You'll see a welcome message. Then just describe a situation:

```
Heavy rain destroyed my crop.
```

The bot will:
1. Identify the life event (`CROP_DAMAGE`).
2. Query the Neo4j knowledge graph for matching schemes.
3. Retrieve supporting evidence chunks from PostgreSQL/pgvector.
4. Ask the LLM to explain the result using only retrieved facts (or compose a deterministic, cited answer if no LLM is running).
5. Reply with a short answer, one button per scheme, and a **📚 Sources** button.

You can then keep chatting. The bot remembers the last few messages, so follow-ups like *"how do I apply for it?"* or *"why did you tell me this?"* work. Messages typed in Hindi or Kannada are answered in that language.

### Available commands

| Command | What it does |
|---|---|
| `/start` | Welcome message and example questions |
| `/help` | Detailed help |
| `/language` | Switch between English, Hindi (हिन्दी), Kannada (ಕನ್ನಡ) |
| `/new` | Start a fresh conversation (forget earlier schemes) |
| `/sources` | Show the sources cited in the last answer |

The command menu is registered with Telegram automatically in all three languages when the bot starts.

### Example conversation

```
You:   Heavy rain destroyed my crop.

Bot:   I'm sorry to hear that. It sounds like you are dealing with Crop Damage.
       Based on the official sources available to me, these schemes may help:

       Crop Loss Input Subsidy (Disaster Relief) — Relief for farmers whose crops
       are damaged by notified natural calamities…
       • Benefit: Input subsidy per hectare of affected area…

       Pradhan Mantri Fasal Bima Yojana (PMFBY) — Crop insurance for notified crops…
       …

       Tap a scheme below to see its documents, eligibility and how to apply.

       [ ℹ️ Crop Damage Assistance ]
       [ ℹ️ Crop Insurance Claim ]
       [ ℹ️ PM-KISAN ]
       [ ℹ️ Crop Loan Relief ]
       [ 📚 Sources (8) ]

(tap "Crop Insurance Claim")

Bot:   Pradhan Mantri Fasal Bima Yojana (PMFBY) – Crop Insurance Claim
       💰 Benefit: Insurance claim for yield loss / localized damage…
       🌐 Apply at: PMFBY official portal
       What would you like to know?
       [ 📄 Documents ] [ ✅ Eligibility ]
       [ 📝 How to apply ] [ 💰 Benefit ]

(tap "How to apply")

Bot:   ❓ How do I apply for Crop Insurance Claim?
       1. An insured farmer should intimate the loss within 72 hours…
       2. The loss can be reported through the Crop Insurance mobile app, …
       🔎 Sources used: 2
       [ 📚 Sources (2) ]

You:   why did you tell me this?

Bot:   I told you this because of the following sources…
```

Tapping **📚 Sources** sends the exact text chunks behind that answer, with publisher, document title, section, link and chunk ID.

---

## Step 6 — Add your own knowledge sources (optional)

The bot's answers come from the knowledge base. To add official government documents:

### Via the web admin

1. Open `http://localhost:5173` and sign in as admin (`admin@demo.gov.in` / `Admin@123`).
2. Go to **Knowledge Base → Upload document** and upload a PDF or paste a URL.
3. The ingestion pipeline extracts, chunks, embeds, and indexes it automatically.
4. Citizens asking the bot will now receive evidence from the new document.

### Via the API directly

```bash
# Upload a PDF
curl -X POST http://localhost:8000/api/documents/ingest \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/scheme.pdf"

# Fetch and index a URL
curl -X POST http://localhost:8000/api/documents/fetch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.gov.in/scheme-guidelines"}'
```

---

## Troubleshooting

### Bot does not respond

1. Check `docker compose logs backend` for errors.
2. Confirm `TELEGRAM_BOT_TOKEN` is set correctly in `backend/.env`.
3. Make sure the backend container is running: `docker compose ps`.
4. The bot uses long-polling; it does not need a public URL or webhook.

### "Couldn't find enough information…"

The knowledge base only contains demo seed data by default. Add official documents (Step 6) to get richer answers.

### Answers are slow

The LLM is running locally inside Docker. First responses after startup may be slower while the model loads into memory. If `qwen3:8b` is too large for your machine, switch to a smaller model in `backend/.env` (`LLM_MODEL=qwen2.5:3b`) and restart.

### Database already exists (upgrading from a previous run)

If you ran the project before adding the Telegram bot, the `users` table does not have a `telegram_id` column yet. The backend adds it automatically on startup via:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(32) UNIQUE;
```

No manual migration is needed.

### Running Ollama on your host (not in Docker)

If Ollama is already running on your machine:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

Then comment out the `ollama` and `ollama-pull` services in `docker-compose.yml` or just leave them — the backend will use the URL you set.

---

## Architecture: how the bot fits in

```
Telegram user
      │  (sends message)
      ▼
python-telegram-bot (polling, async)
      │  running inside the same process as FastAPI
      ▼
asyncio.to_thread()
      │  (KAG is synchronous; off-loaded to thread pool)
      ▼
KAG pipeline (backend/app/kag/)
      ├── understand()   — language detection, life event, intent
      ├── retrieve()     — Neo4j graph facts + pgvector chunks
      ├── build_context()— merge evidence
      └── agent.answer() — LLM + citation validation
      │
      ▼
PostgreSQL (save user, conversation, messages)
      │
      ▼
Telegram HTML reply + inline "Show Evidence" button
```

The bot does **not** make HTTP requests to its own API — it calls the KAG service directly in-process. FastAPI endpoints remain available for the web app and admin tools.

---

## Key files

| File | Purpose |
|---|---|
| `backend/app/bot/telegram.py` | Bot Application setup, start/stop polling |
| `backend/app/bot/handlers.py` | Command and message handlers, DB logic |
| `backend/app/bot/keyboards.py` | Inline keyboard builders |
| `backend/app/bot/formatter.py` | Converts KAG markdown to Telegram HTML |
| `backend/app/main.py` | Starts the bot in the FastAPI lifespan |
| `backend/app/config.py` | `TELEGRAM_BOT_TOKEN` setting |
| `backend/app/models/user.py` | `telegram_id` column on `User` |
