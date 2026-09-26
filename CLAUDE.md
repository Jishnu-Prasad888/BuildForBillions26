# CLAUDE.md

Guidance for Claude Code in this repository. FormBot work follows `FORMBOT_FIX_PLAYBOOK.md`.

## Rules

- Do NOT modify the retrieval pipeline, the LLM choice or the embedding model unless explicitly asked. In this repo the
  protected core is `backend/app/kag/` (query understanding, pgvector + Postgres full-text retrieval with rank fusion,
  the Neo4j scheme graph, prompts, generator) and `backend/app/services/ai.py` (LLM/embedding providers). There is no
  Elasticsearch, BM25 or reranker. Change what goes *into* the pipeline (query text, `context_schemes`, `extra_context`),
  never its internals.
- New logic goes in new, small modules; existing files get minimal, targeted edits.
- Before editing: list the files you'll change and why, then wait for the user's OK.
- Investigate first: report root causes with file:line before fixing.
- After each change: run the tests, show the output, and give manual test steps.
- Typed and voice input must always share one code path. Voice only fills the input box; nothing auto-sends.
- Log failures; never silently skip (e.g. PDF text that didn't fit).
- Privacy (existing design, keep it): values a citizen enters are validated by code and never sent to an LLM. Anything
  sent to an LLM or KAG goes through `app.services.redact.redact` first. OTPs, passwords and PINs are never stored.

## Running tests

- Backend (SQLite, no services needed), inside the backend image so Tesseract and PyMuPDF are present:
  `docker run --rm -v "<repo>/backend:/work" -w /work buildforbillions26-backend sh -c "pip install -q -r requirements-dev.txt && python -m pytest -q tests"`
- Frontend: `cd frontend && npx tsc -b --noEmit && npm run build` (restore `frontend/tsconfig.tsbuildinfo` afterwards).

## Codebase map (FormBot = uploaded-form assistant)

1. **Chat message path.**
   - Uploaded-form chat: `frontend/src/components/formassist/AssistantDock.tsx` (`send`) → `POST /api/forms/{id}/assistant`
     (`backend/app/api/forms.py`, `assistant`) → `FormAssistant.handle` in `backend/app/services/formdoc/assistant.py`.
   - General Q&A: `frontend/src/pages/user/Assistant.tsx` → `POST /api/assistant/chat` (`backend/app/api/assistant.py`) →
     `app.kag.agent.answer`.
   - Mock government form (screen assistance): `frontend/src/components/AssistPanel.tsx` → `POST /api/screen-assistance/sessions/{id}/messages` (`backend/app/api/screen.py`) →
     `backend/app/services/form_assistant.py`.
2. **Field extraction.** `backend/app/services/formdoc/analyze.py` (AcroForm widgets first, then layout detection; OCR
   pixels are scaled to PDF points with `72 / RENDER_DPI`), `detect.py` (labels, value boxes, options, tables),
   `extract.py`, `imaging.py`. Field dict (`service.field_dict`): `field_id, label, description, type, page, bbox`
   (the value area, in page points), `options, required, confidence, source, meta` (`acro_name`, `acro_type`,
   `option_boxes`, `multiple`, …)`, position`. Stored in the `FormField` table.
3. **Form-filling state.** Server: `FormAssistanceSession.state` (`asking` = field being asked, `clarify`, `history`) and
   `FormValue` rows (`{"v": value}` or `{"skipped": true}` / `{"blank": true}`). Next field: `service.next_missing`.
   Frontend: `FormWorkspace.tsx` keeps its own `current` field, passed to the dock as `currentFieldId`.
4. **Prompts.** Form assistant replies are built in `FormAssistant._finish_reply` / `_ask_text` / `_observe`
   (`_observe` produces the "FORM OBSERVATION" section, rendered with that tag by `AssistantDock.tsx`). Q&A prompts:
   `backend/app/kag/prompts.py` (`SYSTEM_PROMPT`, `build_user_prompt`).
5. **KAG query and filters.** `app.kag.agent.answer(db, question, language, context_schemes=…, extra_context=…,
   extra_query=…)` → `query_understanding.understand` (language, intent, scheme mentions, falls back to
   `context_schemes`) → `retriever.retrieve` (vector + keyword search on `retrieval_query + extra_query`, graph-linked
   boost for detected schemes). No other metadata filters.
6. **Speech-to-text.** Browser Web Speech API in `frontend/src/hooks/useSpeech.ts` (`useSpeechInput`), mic button
   `components/VoiceButton.tsx`. Used by `Assistant.tsx`, `AssistantDock.tsx` and `AssistPanel.tsx`.
7. **PDF generation.** `backend/app/services/formdoc/fill.py` (PyMuPDF): AcroForm widgets first, else text overlay in
   the value bbox with shrink-to-fit; called from `forms.py` `generate`.
8. **Tests.** `backend/tests/` (pytest; `conftest.py` sets up SQLite and temp storage; `make_forms.py` builds synthetic
   PDFs; `test_forms.py`). No frontend tests.
