# Sahayak: AI Public Service Assistant

**Build for Billions, Track 3: Reinvent Digital Public Infrastructure for Billions** (hackathon prototype)

Sahayak is a multilingual AI assistant for public services. Its answers are grounded in a knowledge graph. A citizen describes a life event ("Heavy rain destroyed my crop"). Sahayak finds relevant government schemes, explains eligibility and the documents needed, and shows the official evidence behind every claim. It then works beside the citizen on the application form: it reads the screen, answers questions by voice or text, fills in fields, and keeps AI notes and the citizen's own notes.

> **Demo mode.** This is a prototype. The seed "official" documents are plain-language summaries and are marked **DEMO** in the data and UI. The government form, the submission and the status updates are mocks. Nothing is sent to any government portal.

---

## Quick start (Docker Compose)

```bash
cp backend/.env.example backend/.env      # edit if you want OpenAI / Kimi, a different model, etc.
docker compose up --build
```

| Service | URL |
|---|---|
| App (citizen + admin) | http://localhost:5173 |
| API docs (FastAPI) | http://localhost:8000/docs |
| Neo4j browser | http://localhost:7474 (neo4j / password) |
| Ollama | http://localhost:11434 |

**Ollama models.** The `ollama-pull` service pulls the models named in `backend/.env` automatically (`EMBEDDING_MODEL`, `LLM_MODEL`, and `VISION_MODEL` if set). To pull them by hand:

```bash
docker compose exec ollama ollama pull nomic-embed-text
docker compose exec ollama ollama pull qwen3:8b
# optional, for screenshot understanding:
docker compose exec ollama ollama pull qwen2.5vl:7b   # then set VISION_MODEL=qwen2.5vl:7b
```

The app works as soon as it starts. Until the models are downloaded it runs in a clearly labelled fallback: deterministic answer composition and lexical embeddings, reported in **Admin → Overview → AI system** and in `/api/health/ai`. Once the embedding model is available, the backend re-embeds every chunk automatically (you can also click **Re-embed**).

To use Ollama running on your host instead of in Docker, set `OLLAMA_BASE_URL=http://host.docker.internal:11434`.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Citizen (farmer, Mandya) | `ramesh@demo.in` | `Demo@123` |
| Admin | `admin@demo.gov.in` | `Admin@123` |

The sign-in page has one-click buttons for both accounts.

---

## Demo script

### 1. Citizen journey
1. Sign in as **Ramesh**, then open **Talk to Assistant**.
2. Say or type: *"Heavy rain destroyed my crop. What help can I get?"* This also works in Hindi or Kannada: switch the language, then press the mic.
3. The assistant detects the life event **Crop Damage**. It retrieves the schemes linked to that event in Neo4j, retrieves document evidence, and answers with numbered citation chips. Open **Sources used** to see each evidence chunk: publisher, document, section, URL, retrieval method and content hash. **How this answer was grounded** shows each step of the KAG pipeline.
4. Ask *"Why did you tell me this?"*. The assistant lists the exact sources behind its previous answer.
5. Choose **Apply** on *Crop Damage Assistance*. This opens the mock government form.
6. Click **Help Me Fill This Form**, then **Start Screen Assistance** (in the share dialog, pick *This tab*).
7. Talk naturally:
   - *"yes"* accepts a suggestion from the profile.
   - *"What should I put here?"* explains the current or focused field, with evidence.
   - *"Aadhaar"* answers the dynamic question about which ID you have. The next field then becomes *Aadhaar number*.
   - *"I don't know"* marks the field for later. The assistant suggests a note, and you decide whether to add it to **My notes**.
   - *"Where do I find the IFSC?"*, *"change the address"*, *"2 acres 20 guntas"*, *"yesterday"*, *"heavy rain"* also work.
8. Watch the form fill in, the progress panel update and the **AI notes** refresh. The assistant never ticks the declaration box; you tick it yourself.
9. At 100%, open **Review**, check every answer, confirm explicitly and submit (demo). The application then appears in the **Applications** tracker with a timeline, evidence and the conversation. You can also try **Simulate status update**.
10. Leave the form part-way and come back later. The assistant resumes with: *"You were filling … We completed your … The next section requires your …"*

### 2. Admin journey ("the system is not hard-coded")
1. Sign in as **Admin**. **Overview** shows knowledge-base stats, AI provider status and the ingestion pipeline.
2. Go to **Knowledge Base → Upload document** and upload `data/documents/hailstorm-guidance-note-DEMO.pdf`. Watch it move through Uploaded → Extracting → Chunking → Embedding → Indexing → Complete.
3. Open **View chunks + metadata** to see each chunk with its provenance JSON.
4. In the **KAG retrieval playground**, ask *"What should I do after hailstorm damage? Can I clear the field?"*. Evidence from the new PDF appears in the answer. Citizens asking the same question now receive that evidence too.
5. **Sources → Fetch & index** takes an official web page URL and fetches, cleans, chunks, embeds and indexes it.
6. **Schemes** shows the Neo4j graph for each scheme (life event → scheme → rules / documents / department / portal) and has a form for adding schemes. **Users** lets you search, change roles and disable accounts.

---

## Architecture

```
Telegram Bot ──────────────────────────────────────────────────────────────────────────────────────┐
                                                                                                    │
React + TS + Vite + Tailwind  ──/api──►  FastAPI (single backend, same process as Telegram bot)  ◄─┘
                                           ├── PostgreSQL + pgvector: users, applications, notes, documents,
                                           │                          chunks + embeddings, ingestion jobs, conversations
                                           ├── Neo4j: LifeEvent, Scheme, EligibilityRule, DocumentRequirement,
                                           │          Department, State, Portal, Document, Source
                                           └── AI provider interface ─► Ollama | OpenAI | Kimi  (generate / embed)
```

### KAG (Knowledge-Augmented Generation), not plain RAG

`backend/app/kag/`

1. **Query understanding** (`query_understanding.py`). Detects the language (en / hi / kn by script) and translates the question for retrieval: through the LLM when one is available, otherwise through a glossary. It also detects the life event from multilingual keywords stored on the graph, the intent (discover / documents / eligibility / how-to-apply / amount / why) and any schemes the question mentions.
2. **Graph retrieval** (`retriever.py`). Fetches `LifeEvent-[:MATCHES]->Scheme` with rules, required documents, department, portal and state, filtered by the citizen's state. Every graph fact gets a citable ID such as `fact_clr_r3`.
3. **Document retrieval.** Runs a pgvector cosine search (Ollama embeddings) and a PostgreSQL full-text search re-scored with IDF.
4. **Merge and rank.** Combines the two searches with reciprocal-rank fusion, adds a small boost for chunks linked to graph schemes and for sections matching the intent, and keeps per-document diversity.
5. **Graph → Document → Chunk anchors.** Each scheme found in the graph is backed by a chunk from its `DESCRIBED_IN` source document.
6. **KAG context.** Graph facts and evidence chunks, each labelled with its ID, publisher, section and demo flag, go to the LLM with the anti-hallucination system prompt (`prompts.py`).
7. **Validated citations.** The LLM must return JSON with inline `[chunk_…]` / `[fact_…]` IDs. The backend drops any ID it did not supply and resolves all metadata itself. The LLM never supplies source metadata. An answer with no valid citation is flagged as unverified. When there is no relevant evidence, the assistant replies: *"I couldn't find enough information in the available official sources to verify that."*

Switching `LLM_PROVIDER` does not change this flow.

### Screen-aware form assistance

`backend/app/services/form_assistant.py`

- **Screen context.** The browser sends a structured reading of what is visible on screen: field labels, required markers, filled or empty state, the focused field, buttons and warnings. When screen sharing is on and `VISION_MODEL` is set, it also sends a downscaled frame for the vision model to read. Frames are never stored.
- **Dialogue.** A deterministic state machine handles profile suggestions, skip / later, "change X", review, questions (answered through KAG with the screen context) and answers. Answers are parsed by validators for dates, mobile numbers, Aadhaar (rejecting 16-digit VIDs), driving licence numbers, IFSC, survey numbers, acres/guntas/hectares, percentages and multilingual option synonyms. When the validators fail, the LLM extracts the value, and the result is checked by the validators again.
- **Where-to-find hints.** Every question comes with a hint retrieved from the form guide, which is cited evidence.
- **AI notes** are application-specific and regenerated each turn: completed sections, pending fields, documents found or missing in the wallet, and open questions. The AI can only *suggest* **user notes**; it writes one only after the user accepts.

### Provider abstraction

`backend/app/services/ai/`

- Callers use `get_ai().generate()`, `generate_json()` and `embed()`.
- Implementations: `ollama.py`, `openai.py`, and `kimi.py` (Kimi uses an OpenAI-compatible API).
- Each chunk stores its `embedding_model`, so vectors from different embedding spaces are never compared.

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-5-mini
OPENAI_API_KEY=...
```

Change `.env` and restart. No code changes are needed. API keys are never returned by the API.

---

## Telegram Bot

Sahayak runs a Telegram bot in the same Python process as the FastAPI backend. Citizens interact entirely through Telegram; the bot calls the same KAG pipeline used by the web app.

### Setup

1. Create a bot via [@BotFather](https://t.me/botfather) and copy the token.
2. Add it to `backend/.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456789:ABCdef...
   ```
3. Restart the backend (`docker compose up --build`). The bot starts automatically.

### Commands

| Command | Description |
|---|---|
| `/start` | Welcome message |
| `/help` | Usage instructions |
| `/language` | Switch between English, Hindi, Kannada |
| `/sources` | Show sources from the last answer |

### Conversation flow

Just send a natural message — no slash command needed:

```
You:  Heavy rain destroyed my crop.
Bot:  🌧️ I found information about crop damage schemes...
      Which state are you in?
      [ Karnataka ]  [ Other State ]

You:  Karnataka
Bot:  🌾 Based on the available information...
      🔎 Sources used: 2
      [ 📚 Show Evidence (2) ]
```

Every answer is grounded in the knowledge base. Tap **Show Evidence** to see the exact chunks retrieved. Conversation context (life event, state, crop type) is carried across turns. Telegram users are identified by their Telegram ID — no password or registration needed.

---

## Project layout

```
backend/app/
  main.py, config.py            FastAPI app, typed settings (pydantic-settings, backend/.env)
  api/                          auth, users, admin, schemes, assistant, kag, applications, notes, documents, screen-assistance, health
  auth/                         bcrypt hashing, JWT, role dependencies
  models/, schemas/             SQLAlchemy models, Pydantic request models
  database/                     engine / session, pgvector extension
  graph/store.py                Neo4j store (+ in-memory fallback with the same interface)
  ingestion/                    extract (PDF/HTML/TXT/MD/DOCX), chunker, pipeline, web fetch
  kag/                          understanding, retriever, agent, prompts, localized templates
  services/                     ai providers, form assistant, forms/validators, notes, seed
  bot/                          Telegram bot (handlers, keyboards, HTML formatter, lifecycle)
data/seed/                      graph.json, demo documents (marked DEMO), demo form definition
data/documents/                 sample documents for the admin upload demo
frontend/src/                   pages (auth, user, admin), components, layouts, hooks (speech, screen capture), i18n
whisper-chat-app/               Expo app: on-device whisper-small speech-to-text (needs a dev build, see its README)
```

## API overview

`/api/auth`, `/api/users`, `/api/schemes`, `/api/assistant`, `/api/kag`, `/api/applications`, `/api/notes`, `/api/documents`, `/api/screen-assistance`, `/api/admin/{overview,users,documents,sources,ingestion,schemes,graph,reembed}`, `/api/health`, `/api/health/ai`. Full interactive docs are at `/docs`.

## Local development without Docker

```bash
# Postgres 16 with pgvector running locally; Neo4j and Ollama are optional (fallbacks exist)
cd backend && cp .env.example .env
# edit .env: DATABASE_URL=...@localhost..., NEO4J_URI=bolt://localhost:7687, OLLAMA_BASE_URL=http://localhost:11434, SEED_DIR=../data/seed
python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload

cd ../frontend && npm install && npm run dev     # http://localhost:5173 (proxies /api to :8000)
```

## Security and privacy (prototype level)

- Passwords are hashed with bcrypt. Authentication uses JWTs, with USER / ADMIN roles checked on every admin route.
- Inputs are validated with Pydantic. Uploads are checked by type and size. Disabled accounts cannot sign in.
- Screen frames are not stored. Aadhaar and account numbers are masked in chat and review.
- The forgot-password flow shows the reset token on screen, because the prototype has no email service. This happens in demo mode only.
- Out of scope, on purpose: SSO, complex RBAC, distributed queues and production observability.

## Knowledge sources

The seed documents summarise publicly described features of crop-loss disaster relief (SDRF/NDRF input subsidy), PMFBY, PM-KISAN and Kisan Credit Card calamity relief. Each one is marked `is_demo: true` and links only to the root domain of the official portal (e.g. `pmfby.gov.in`, `pmkisan.gov.in`, `landrecords.karnataka.gov.in`, `sbi.co.in`). Amounts and rules change, so the assistant always tells users to confirm on the official portal. In a real deployment, admins would load the actual official PDFs and pages through **Knowledge Base** and **Sources**.
