# Sahayak REST API

Base URL (local): `http://localhost:8000`

Interactive OpenAPI / Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)  
ReDoc: `/redoc`

All JSON request and response bodies use UTF-8. Timestamps are ISO-8601 UTC.

Companion docs: [README](../README.md), [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Conventions

### Authentication

Protected routes expect:

```http
Authorization: Bearer <access_token>
```

Obtain the token from `POST /api/auth/signin` or `POST /api/auth/signup`. The web app stores it as `sahayak.token`. JWTs are stateless; `POST /api/auth/logout` is a client-side discard.

| Dependency | Who can call |
|---|---|
| Public | Health, root, auth signup/signin/forgot/reset, logout |
| `get_current_user` | Any active user |
| `require_admin` | `role === "ADMIN"` (entire `/api/admin` router) |

Telegram users do not use this HTTP API for chat; the bot talks to KAG in-process.

### Errors

FastAPI `HTTPException`: `{ "detail": "<string or validation list>" }`.

| Status | Typical meaning |
|---|---|
| 400 | Business rule (already submitted, confirmation missing, …) |
| 401 | Missing / invalid / expired token, or disabled account on protected routes |
| 403 | Not admin, or demo-only endpoint with `DEMO_MODE=false` |
| 404 | Resource missing or not owned by the caller (ownership is not leaked) |
| 409 | Email already registered |
| 413 | Upload larger than `MAX_UPLOAD_SIZE` (default 50 MB) |
| 422 | Validation (Pydantic or file type) |
| 429 | Rate limit exceeded. `Retry-After` gives the seconds to wait. |

### Rate limits

Limited `/api` responses carry `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`. Requests are counted per signed-in user, or per IP when there is no valid token. Health checks are exempt.

| Tier | Endpoints | Default |
|---|---|---|
| auth (per IP) | `POST /api/auth/signin`, `signup`, `forgot-password`, `reset-password` | 20/min, burst 10 |
| ai | `POST /api/assistant/chat`, `/api/kag/query`, screen-assistance sessions and messages | 20/min, burst 8 |
| upload | document uploads, admin ingestion and re-embed | 10/min, burst 5 |
| default | all other `/api` requests | 180/min, burst 60 |

Configured with `RATE_LIMIT_*` settings; see [DEPLOYMENT.md](../DEPLOYMENT.md#rate-limiting).

### Languages

Wherever `language` or `lang` appears, allowed values are `en`, `hi`, `kn`.

---

## Root

### `GET /`

```json
{ "name": "Public Service AI Assistant API", "docs": "/docs", "demo_mode": true }
```

`/docs`, `/redoc` and `/openapi.json` are disabled when `APP_ENV=production`.

---

## Health

### `GET /api/health`

No auth.

| Field | Meaning |
|---|---|
| `status` | `ok` or `degraded` (Postgres ping) |
| `database` | `connected` \| `unavailable` |
| `vector_backend` | `pgvector` \| `json` |
| `graph_backend` | `neo4j` \| `memory` |
| `demo_mode` | from settings |
| `rate_limit` | `redis` (shared across replicas) \| `memory` (per process) \| `disabled` |

### `GET /api/health/ai`

No auth. Provider/model reachability. **Never includes API keys.**

---

## Auth — `/api/auth`

### `POST /api/auth/signup` — 201

Body:

| Field | Rules |
|---|---|
| `email` | Email |
| `full_name` | 2–120 chars |
| `password` | 8–128 chars |
| `preferred_language` | `en` \| `hi` \| `kn` (default `en`) |

Response `TokenOut`: `access_token`, `token_type: "bearer"`, `user` (`UserOut`). Role is always `USER`.

### `POST /api/auth/signin`

Body: `email`, `password`. Same `TokenOut`. 401 incorrect credentials; 403 disabled account.

### `POST /api/auth/logout`

Returns `{ "ok": true }`. No server-side revoke.

### `POST /api/auth/forgot-password`

Body: `{ "email": "..." }`. Always `{ "message": "If an account exists…" }`. If `DEMO_MODE` and the user exists, also `demo_reset_token`.

### `POST /api/auth/reset-password`

Body: `token` (10–128), `password` (8–128). Invalid/expired token → 400.

### `GET /api/auth/me`

Auth required. `UserOut`:

```json
{
  "id": "...",
  "email": "ramesh@demo.in",
  "full_name": "...",
  "role": "USER",
  "is_active": true,
  "preferred_language": "en",
  "profile": { "phone": "", "state": "Karnataka", "district": "", "taluk": "", "village": "", "occupation": "", "land_acres": "" },
  "created_at": "...",
  "last_login_at": "..."
}
```

---

## Users — `/api/users`

### `PATCH /api/users/me`

Auth. Body (all optional): `full_name`, `preferred_language`, `profile`.

Profile keys merged if present: `phone`, `state`, `district`, `taluk`, `village`, `occupation`, `land_acres`.

Returns `UserOut`.

---

## Schemes — `/api/schemes`

Auth required.

### `GET /api/schemes?lang=en`

Array of scheme cards from the graph (localized names/summaries when available).

### `GET /api/schemes/life-events`

`{ code, name, names, description }[]`.

### `GET /api/schemes/forms/{form_id}`

JSON form definition used by the mock UI. 404 if unknown.

### `GET /api/schemes/{code}?lang=en`

Scheme card plus:

- `sources` — knowledge documents linked from the graph (`id`, `title`, `publisher`, `url`, `is_demo`)
- `graph` — neighbourhood for visualization (`nodes` / `edges` style payload from `graph_view`)

404 if the code is missing.

---

## Assistant — `/api/assistant`

Auth; conversations are private to the caller.

### `POST /api/assistant/chat`

Body:

| Field | Rules |
|---|---|
| `message` | 1–4000 chars |
| `conversation_id` | optional; 404 if not owned |
| `language` | optional `en` \| `hi` \| `kn` |
| `application_id` | optional; biases retrieval toward that scheme |

Creates a conversation if needed (`kind: "assistant"`). Runs KAG unless intent is **why** (then cites the previous assistant evidence).

Response:

```json
{
  "conversation_id": "...",
  "message": {
    "id": "...",
    "role": "assistant",
    "content": "...",
    "evidence": [],
    "meta": {
      "grounded": true,
      "insufficient_evidence": false,
      "mode": "llm",
      "understanding": {},
      "scheme_cards": [],
      "schemes": ["CROP_LOSS_RELIEF_KA"],
      "retrieved_count": 6
    },
    "created_at": "..."
  },
  "retrieved": []
}
```

`mode` may be `llm`, `rule`, or fallback composition. `evidence` items include ids such as `chunk_…` / `fact_…` plus publisher, title, section, URL, retrieval method, hashes as produced by the retriever.

### `GET /api/assistant/conversations`

Up to 30 conversations: `id`, `title`, `kind`, `language`, `application_id`, `updated_at`.

### `GET /api/assistant/conversations/{cid}`

Full message list. 404 if not owned.

---

## KAG playground — `/api/kag`

Auth (any logged-in user, including admin UI).

### `POST /api/kag/query`

Body:

| Field | Rules |
|---|---|
| `question` | 2–2000 chars |
| `language` | optional |
| `generate` | default `true` — run LLM; `false` returns understanding + retrieved facts/chunks + debug only |

When `generate` is true, the payload matches `agent.answer` (answer, evidence, citations, grounded, schemes, understanding, retrieval debug).

---

## Applications — `/api/applications`

Auth; all `{aid}` routes are owner-only (404 otherwise).

### `GET /api/applications`

List of application summaries (`app_out`).

### `POST /api/applications` — 201

Body: `{ "scheme_code": "...", "evidence": [ { ... } ] }` (`evidence` optional, max 20 stored).

If a non-terminal draft already exists for that scheme, returns that application with `"existing": true`.

Otherwise creates `IN_PROGRESS` (or `DRAFT` if no form), seeds AI notes.

Statuses: `DRAFT`, `IN_PROGRESS`, `DOCUMENTS_REQUIRED`, `SUBMITTED`, `UNDER_REVIEW`, `FIELD_VERIFICATION`, `APPROVED`.

### `GET /api/applications/{aid}`

Summary plus `form_data`, `field_status`, `form`, `sections`, `scheme`, attached `documents`, `wallet`, `ai_notes`, `user_notes`, merged `evidence`, `conversation` messages, `active_session_id` (open `form_assistance` conversation).

### `PATCH /api/applications/{aid}/form`

Body: `{ "values": { "field_id": "..." } }`. Only known field ids; strings max 500 chars. Not allowed after submit. Recalculates progress and AI notes.

### `POST /api/applications/{aid}/submit`

Body: `{ "confirm": true }`. Requires 100% required fields. Sets `SUBMITTED`, demo `reference_number` like `DEMO-CRO-2026-1234`, closes open conversations. **Does not call any government API.**

### `POST /api/applications/{aid}/simulate-status`

`DEMO_MODE` only (else 403). Advances `SUBMITTED → UNDER_REVIEW → FIELD_VERIFICATION → APPROVED`.

### `POST /api/applications/{aid}/documents`

Body: `{ "user_document_id": "...", "requirement_code": "..." }`. Attaches a wallet file. 404 if the document is not yours.

---

## Notes — `/api/notes`

Auth.

### `GET /api/notes?application_id=&kind=`

Own notes. `kind` filters `USER` or `AI`. With `application_id`, includes that app’s notes plus global `USER` notes (`application_id` null).

### `POST /api/notes` — 201

Body: `content` (1–2000), `item_type` `todo` \| `question` \| `text`, optional `application_id`, `origin` `user` \| `ai_suggested`. Always creates `kind: USER`.

### `PATCH /api/notes/{nid}`

`content`, `done`, `item_type`. **AI notes cannot be edited** (400).

### `DELETE /api/notes/{nid}`

User notes only.

---

## Citizen documents (wallet) — `/api/documents`

Auth. Distinct from admin knowledge-base documents.

### `GET /api/documents`

Wallet list (`doc_out`). `extracted_text` truncated to 600 chars in the listing.

### `POST /api/documents` — 201

`multipart/form-data`:

| Field | Rules |
|---|---|
| `doc_type` | `AADHAAR` \| `DRIVING_LICENCE` \| `LAND_RECORD` \| `BANK` \| `CERTIFICATE` \| `OTHER` |
| `title` | max 200 |
| `file` | optional; `.pdf` `.png` `.jpg` `.jpeg` `.txt` |

PDF/TXT may get `extracted_text` (capped). File is optional so a title-only placeholder can exist.

### `GET /api/documents/{did}/file`

File download for the owner.

### `DELETE /api/documents/{did}`

Deletes DB row and file on disk.

---

## Screen assistance — `/api/screen-assistance`

Auth. Sessions are conversations with `kind: "form_assistance"`.

### Screen payload (`ScreenIn`)

| Field | Notes |
|---|---|
| `visible_fields` | `{ id, label, … }[]` as the client reads the DOM |
| `focused_field_id` | optional |
| `buttons` / `warnings` | strings |
| `values` | current field values |
| `frame` | optional base64 JPEG, max ~4e6 chars; **never stored** |

### `POST /api/screen-assistance/sessions` — 201

Body: `application_id`, `language`, optional `screen`, `screen_shared`.

Ends any previous open session for that application (state such as skipped fields is carried over). Application must not be already submitted.

Returns the first assistant turn from `FormAssistant.start` (message, suggested fills, progress, etc.).

### `POST /api/screen-assistance/sessions/{sid}/messages`

Body: `text` (1–2000), optional `screen`, `language`. Returns the next assistant action (fill patches, notes suggestions, evidence).

### `POST /api/screen-assistance/sessions/{sid}/end`

Marks the session ended; system message in the conversation.

### `GET /api/screen-assistance/sessions/{sid}`

`id`, `language`, `ended`, `current_field`, `messages`.

---

## Admin — `/api/admin`

**All routes require an admin JWT.** Non-admins receive 403.

### Overview

#### `GET /api/admin/overview`

Counts (documents, sources, chunks, users, applications), `graph` stats, `last_indexed`, `recent_ingestion` (8 jobs), `ai` health, `embeddings_by_model`, `vector_backend`, `pipeline_stages`.

### Users

#### `GET /api/admin/users?q=`

Up to 200 users. `q` matches email or full name (case-insensitive). Each row is `UserOut` plus `applications` count.

#### `PATCH /api/admin/users/{uid}`

Body: optional `role` (`USER` \| `ADMIN`), `is_active`. You cannot disable or demote **yourself**.

### Knowledge documents

#### `GET /api/admin/documents`

All KB documents with optional source `{ id, name, is_official }`.

#### `POST /api/admin/documents` — 202

`multipart/form-data`: `file` (required), `title`, `publisher`, `source_name`, `source_url`, `published_date`, `is_demo`, `scheme_codes` (comma-separated).

Allowed extensions: `.pdf` `.txt` `.md` `.markdown` `.html` `.htm` `.docx`. PDF magic bytes checked.

Starts a background ingestion job. Returns `{ document, job }`.

#### `GET /api/admin/documents/{did}`

Document metadata, jobs, and **full chunks** (content, section, page, hashes, embedding_model, provenance fields).

#### `DELETE /api/admin/documents/{did}`

Deletes jobs, chunks, file, DB row, and graph document node.

#### `POST /api/admin/documents/{did}/reindex` — 202

New job. Seed documents cannot be reindexed this way (400); they refresh on startup.

#### `POST /api/admin/reembed`

Re-embeds all chunks with the current embedding model. Returns a summary from `reembed_all`.

### Sources (web fetch)

#### `GET /api/admin/sources`

Sources with document counts.

#### `POST /api/admin/sources` — 202

JSON:

```json
{
  "url": "https://example.gov.in/page",
  "title": "optional",
  "publisher": "optional",
  "scheme_codes": ["PMFBY"]
}
```

`url` must be `http` or `https`. Fetches HTML, then the same pipeline as uploads (`kind: "web"`).

### Ingestion jobs

#### `GET /api/admin/ingestion`

Latest 100 jobs. Status follows `UPLOADED` → `EXTRACTING` → `CHUNKING` → `EMBEDDING` → `INDEXING` → `COMPLETE` (or failed with `error`).

#### `GET /api/admin/ingestion/{jid}`

Single job: `id`, `document_id`, `kind`, `title`, `status`, `stages[]`, `detail`, `error`, timestamps.

### Schemes and graph

#### `GET /api/admin/schemes`

`{ schemes: [...], stats }` including `life_events`, `states`, `source_docs` per scheme.

#### `POST /api/admin/schemes` — 201

```json
{
  "code": "MY_SCHEME",
  "name": "Display name",
  "short_name": "",
  "summary": "",
  "benefit": "",
  "life_events": ["CROP_DAMAGE"],
  "department": null,
  "states": ["KA"],
  "portal": null,
  "documents": [],
  "rules": [{ "code": "", "text": "Must own land", "field": "", "supported_by": null }],
  "source_doc": null
}
```

`code` pattern: `^[A-Z0-9_]{3,40}$`. Upserts into Neo4j (or memory graph).

#### `GET /api/admin/graph?scheme=`

Graph view for visualization. Optional `scheme` code filters to that neighbourhood.

---

## Example: sign in and ask the assistant

```bash
TOKEN=$(curl -s http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"ramesh@demo.in","password":"Demo@123"}' | jq -r .access_token)

curl -s http://localhost:8000/api/assistant/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Heavy rain destroyed my crop. What help can I get?","language":"en"}'
```

Admin upload:

```bash
ADMIN=$(curl -s http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.gov.in","password":"Admin@123"}' | jq -r .access_token)

curl -s http://localhost:8000/api/admin/documents \
  -H "Authorization: Bearer $ADMIN" \
  -F "file=@data/documents/crop-damage-field-survey-advisory-DEMO.md" \
  -F "title=Field survey advisory" \
  -F "is_demo=true"
```

---

## OpenAPI as source of truth

Request field constraints and response models that use Pydantic `response_model` are fully described at `/docs`. This document adds ownership rules, demo behaviour, and payloads that the routers return as plain `dict`s.

---

## AI Form Assistant — `/api/forms`

Upload any form, let the app read it, collect values and produce a completed PDF. Everything is scoped to the signed-in user; another user's form returns `404`. Design notes: [FORM_ASSISTANT.md](FORM_ASSISTANT.md).

| Method & path | Purpose |
|---|---|
| `POST /api/forms/upload` (multipart `file`) | Validate (extension, magic bytes, MIME, size, encryption) and store the original. `201` → form. `413` too large, `422` rejected. |
| `GET /api/forms` | The user's forms, newest first. |
| `GET /api/forms/{id}` | One form: `status` (`UPLOADED`, `ANALYZING`, `READY`, `FAILED`, `COMPLETED`), `error`, `output_ready`. |
| `DELETE /api/forms/{id}` | Delete the form, derived files, values, notes and output. |
| `POST /api/forms/{id}/analyze` `{force?}` | Start analysis in the background (`202`); poll `GET /api/forms/{id}`. |
| `GET /api/forms/{id}/schema` | Pages (`width`, `height`, coordinate space), fields (`field_id`, `label`, `description`, `type`, `page`, `bbox`, `options`, `required`, `confidence`, `source`), `values`, `summary`, `ai_notes`, `profile_suggestions`. `409` until analysed. |
| `POST /api/forms/{id}/autofill` `{values, use_profile?, skip?, rename?}` | Validate and save values. Returns the schema plus `saved` and per-field `errors`. Empty string clears a value. |
| `POST /api/forms/{id}/assistant` `{message, current_field_id?, language, frame?, screen_shared?}` | Conversational turn. Empty `message` starts/greets. Returns `sections` (`form_observation` \| `knowledge` \| `assistant`), `ask`, `choices`, `clarification`, `field_updates`, `summary`, `evidence`. |
| `GET /api/forms/{id}/assistant` | Stored transcript (no entered values). |
| `POST /api/forms/{id}/assistant/end` | End the session. |
| `GET /api/forms/{id}/review` | Per-field review items (identity/bank numbers masked), `missing`, `can_generate`. |
| `POST /api/forms/{id}/generate` `{allow_blank?}` | Create `completed.pdf` from a copy. `422 {code: "missing_required", missing: [...]}` unless the fields are filled or listed in `allow_blank`. `500` “I couldn't generate the completed PDF. Your original form has not been modified.” |
| `GET /api/forms/{id}/preview?page=1&source=original\|completed` | PNG of a page (`Cache-Control: private, no-store`). |
| `GET /api/forms/{id}/download` | The completed PDF. |
| `GET/POST /api/forms/{id}/notes`, `PATCH/DELETE /api/forms/{id}/notes/{nid}` | The citizen's own notes (`GET` also returns the derived `ai_notes`; they are separate and AI notes cannot be edited). |

