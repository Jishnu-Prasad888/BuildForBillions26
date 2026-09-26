# FormBot Fix Playbook (for Claude Code)

This playbook fixes the current FormBot bugs and adds the new features **without changing the core RAG/KAG architecture** (vector search, BM25, Elasticsearch, knowledge graph, reranker, generator). All new behaviour goes into a thin layer in front of that pipeline.

> **Mapping to this repository.** Sahayak has no Elasticsearch, BM25 or reranker. The protected "core pipeline" here is `backend/app/kag/` (query understanding, pgvector + Postgres full-text retrieval with rank fusion, the Neo4j scheme graph, prompts and the generator) plus `backend/app/services/ai.py` (LLM and embedding providers). "FormBot" is the uploaded-form assistant in `backend/app/services/formdoc/` and `frontend/src/components/formassist/`. See `CLAUDE.md` for the full map.

**How to use it:** put this file in your repo root. Run the prompts in Part 4 **one at a time, in order**, in Claude Code. Each prompt has a goal, the text to paste, where Claude should look, what "done" means, and what to watch out for. Don't start the next prompt until the current one passes its "Done when" checks and you have committed.

---

## Part 1: What is broken and why

| # | Symptom | Real root cause |
|---|---------|-----------------|
| 1 | Voice/typed input saved raw ("my name is Nithin" instead of "Nithin") | No value-extraction step; the whole message is saved as the field value |
| 2 | Values not appearing in the generated PDF | Likely: drawing into the label's bbox instead of the blank space, text too big for the box (PyMuPDF draws nothing when text doesn't fit), OCR pixel coordinates not converted to PDF points, Helvetica can't render Hindi/Kannada, or values keyed by label instead of field id |
| 3 | Every answer starts with the same "FORM OBSERVATION… field called Branch…" block | A fixed template is prepended to every reply |
| 4 | Account-number question answered with crop-insurance (PMFBY) info | Retrieval isn't scoped to the current form/scheme, and the query is polluted by the bot's own prompt text |
| 5 | Hindi question saved as the "Branch" value | Every message in form mode is treated as an answer; there's no intent detection |
| 6 | Asked about "To" but the answer went to "Branch"; "Skip" skipped the wrong field | Off-by-one state bug: the displayed field and the field being answered are out of sync (stale frontend state, or the pointer advances at the wrong time) |
| 7 | "i do not know" on "Select one" just skipped | No `dont_know` handling; the options should be explained first |
| 8 | "70 office use" asked to the user | Office-use fields aren't filtered out |
| 9 | Voice auto-sends; voice only works in form mode | STT is wired to auto-send and isn't part of a shared input used everywhere |

New features: **voice everywhere** (general Q&A and form filling, send only on Send/Enter), a **Reference button** on agent messages, and a **Share UI**.

---

## Part 2: Target architecture (thin layer, core untouched)

```
 Voice (STT) ─┐
              ├─► ONE shared input box ──(Send button / Enter only)──► /chat API
 Typing ──────┘                                                          │
                                                                         ▼
                                                    QUERY NORMALIZER (new, all turns)
                                                    fillers, ASR fixes, language
                                                                         │
                                          ┌── form active? ──────────────┤
                                          │ no                           │ yes
                                          ▼                              ▼
                                   Q&A (existing KAG)        TURN ROUTER (new)
                                                             rules + LLM JSON intent
                                                                         │
                  ┌──────────────┬───────────────┬──────────────┬────────┴─────────┐
              answer /        question        skip         dont_know        reference
              correction         │              │              │             active
                  │         existing KAG,       │         explain field     (always
          validate +        scoped to form      │         via KAG,          treated as
          normalize             │               │         re-ask            question)
                  ▼              ▼              ▼              ▼                 ▼
          FORM STATE (server = single source of truth, keyed by field id)
                  │
                  ▼
          RESPONSE COMPOSER (the ONLY place that builds the next-field prompt)
                  │
                  ▼
          PDF FILLER (AcroForm widgets first, else OCR value-box overlay)
```

Key principles:

1. **Voice is just another way to type.** Voice and typing fill the same box, use the same `send()` and hit the same endpoint. Mode decides the routing; input method never does.
2. **The server owns form state.** The frontend only displays it.
3. **Classify, then act.** No message is saved as a field value until the router says it's an answer.
4. **Retrieval stays as-is.** Only the query that goes *into* it and the metadata filters change.

---

## Part 3: Protocols

### 3.1 Your protocol (the human)

1. **Commit before you start:** `git add -A && git commit -m "baseline before fixes"`.
2. **One prompt per task.** Never "fix everything."
3. **Plan before edit.** Use plan mode (Shift+Tab) or ask for the plan first. Reject any plan that edits retrieval, KAG, the reranker or the generator unless the prompt says so.
4. **Test it yourself after each prompt:** on the real KCC form, by voice and by typing, in English and Hinglish.
5. **Commit after each passing prompt,** e.g. `git commit -m "P2: turn router + server state"`.
6. **Reset if it loops.** If Claude fails the same fix 2–3 times, run `/clear` and restart with the task, what was tried, and why it failed.
7. **Keep the evidence.** Save the buggy transcript as `tests/fixtures/kcc_transcript.txt` (paste the chat from the bug report). This is the main regression test.

### 3.2 Claude's protocol (goes into CLAUDE.md in Prompt 0)

- Don't modify the retrieval pipeline (vector search, BM25, Elasticsearch, knowledge graph, reranker, generator) unless explicitly asked.
- Put new logic in new, small modules. Existing files get minimal, targeted edits.
- Before editing: list the files to change and why, and wait for approval.
- Investigate before fixing: show the root cause with file and line numbers.
- After each change: run the tests, show the output, and give a manual test script.
- Never silently swallow errors. Log failures (for example PDF text that didn't fit).
- Don't change the LLM model or embedding model.
- Keep typed and voice input on one code path.

---

## Part 4: The prompts

### Prompt 0: Ground rules and codebase map

**Goal:** Claude learns the codebase and the rules before touching anything.

Create CLAUDE.md with the rules above, then explore the codebase without changing anything and map: (1) where a chat message is received and handled (frontend → API → backend); (2) where form fields are extracted from uploaded PDFs (AcroForm and/or OCR) and what a field object looks like; (3) where form-filling state lives and how the "current field" pointer is stored and advanced; (4) where prompts are built for Q&A and form filling, including the "FORM OBSERVATION" template; (5) where the RAG/KAG query is constructed and where metadata filters are applied; (6) where speech-to-text is wired and every place that triggers sending a message; (7) where the final PDF is generated and with which library; (8) existing tests and how to run them.

**Done when:** CLAUDE.md exists and the map covers all 8 points with file paths.

**Watch out for:** Claude "helpfully" fixing things during exploration. Tell it to revert.

---

### Prompt 1: Diagnose the form-state bug (investigate only)

**Goal:** find the exact cause of the off-by-one and the question-saved-as-value bug. Using `tests/fixtures/kcc_transcript.txt`, trace the path from pressing send to a value being saved; find where the current-field pointer is read, where it advances and where the next prompt is built. Check for stale React state or closures, state saved in the wrong order relative to the pointer advancing, the next prompt built before the answer is processed, and frontend and backend each keeping their own pointer. Report each root cause with file:line. Don't fix anything yet.

---

### Prompt 2: Server-side form state and turn router

**Goal:** fix bugs 1, 5, 6, 7 and 8. Messages are classified before anything is saved.

A) **Server owns the form state.** One FormSession on the server; every bot prompt for a field includes `pending_field_id`, the client sends it back, and a mismatch saves nothing and re-prompts the current field. Advance the pointer only after the answer is processed. Build the next-field prompt in one place (a response composer) from the updated state. The frontend only renders server state.

B) **Turn router** (new module) runs only when a form is active. Cheap rules first (skip words: skip, chhodo, baad mein, later, next; question markers: ?, kaise, kya, kyun, kaun, kitna, how, what, why, which, can i, should i), then an LLM call that returns only JSON `{"intent": "answer|question|skip|dont_know|correction|other", "value": string|null, "target_field": field_id|null, "confidence": 0-1}`. Value = only the value ("my name is Nithin" → "Nithin", "mera naam Ravi hai" → "Ravi", "branch Jayanagar hai" → "Jayanagar"). Any question, even without "?", is a question. "pata nahi", "i don't know", "nahi maloom" → dont_know. "actually my branch is X" → correction with target_field. Never invent a value.

C) **Actions per intent.** answer/correction: validate by field type (account number 9–18 digits; IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`; dates DD/MM/YYYY; choices must match an option; mobile 10 digits); if confidence < 0.7 or validation fails, confirm before saving; save by field id. question: existing Q&A path, then re-ask the same field in one short line. dont_know: explain the field (and each option) via the knowledge base, re-ask, mention skip. skip: mark skipped, advance. other: answer briefly and re-ask.

D) **Field list hygiene.** Drop fields whose label contains "office use", "for bank use", "for office", "official use", "to be filled by bank". Deduplicate fields with the same label and bbox on the same page.

E) **Tests.** Replay the KCC transcript and assert the Hindi question is not saved, the reply after "To" applies to "To", "Skip" skips the displayed field, and "i do not know" on "Select one" produces an explanation. Add 30+ labelled router cases in English, Hindi and Hinglish, including voice-style text with fillers.

**Watch out for:** Claude putting the router inside the retrieval code. It must be a separate module in front of it.

---

### Prompt 3: PDF filling

**Goal:** fix bug 2. Investigate in order: AcroForm widgets used when present; OCR text drawn into the label's bbox instead of the value space; OCR pixel coordinates converted to PDF points (scale = page width / image width, y-origin, rotation); `insert_textbox` negative return retried at smaller sizes and logged; per-script fonts (Noto Sans, Noto Sans Devanagari, Noto Sans Kannada); values keyed by field id. Show root causes, then fix. Tests: fill a sample form with English and Hindi values, extract the text back and assert every value is on the correct page; save a PNG of each filled page to `tests/output/`; show unfilled or failed fields in the review screen before download.

---

### Prompt 4: One shared input with voice everywhere

**Goal:** fix bug 9. One shared ChatInput (textarea + mic + send) used in all modes. STT only fills the box (interim results update the draft live, appended to typed text); no auto-send. Send only via the Send button or Enter (Shift+Enter = new line; ignore Enter while `isComposing`). Typed and voice call the same `send()` with `input_mode: "voice" | "text"` for logging only. A language picker next to the mic (en-IN, hi-IN, kn-IN). A clear listening state; stop listening on send; friendly permission-denied message.

---

### Prompt 5: Query normalizer (voice-quality queries for Q&A)

**Goal:** spoken and Hinglish questions retrieve the same sources as clean typed ones. A new module that runs on every message before retrieval: strip fillers and repetitions; fix ASR errors on banking terms with an `asr_variants` map (k c c → KCC, i f s c / ifc code → IFSC, kisaan credit card → Kisan Credit Card, p m f b y → PMFBY, k y c → KYC, n e f t → NEFT); build an English retrieval query for Hindi/Kannada/Hinglish while answering in the user's language; route (no form → Q&A; form → turn router; "fill the KCC form" / "form bharna hai" → offer form mode); log original text, normalized query, language, input mode, intent and retrieved doc ids. Tests: 20+ voice-style queries.

---

### Prompt 6: Mid-form questions (no repeated preamble, scoped retrieval)

**Goal:** fix bugs 3 and 4. Remove the "FORM OBSERVATION" template; put form and field context in the system prompt as hidden context. Reply format: direct answer in the user's language, sources, then one short re-ask line; the "confirm on the official portal" line at most once per session. Scope retrieval for mid-form questions to the current form's scheme; build the query as normalized question + current field label + form name, never the bot's own prompt text; fall back to unscoped search if too few results. Only touch query construction, filters and prompt templates.

---

### Prompt 7: Reference button

**Goal:** the user can pin one agent message as the main context for the follow-up. A Quote/Reply button under every agent message sets `referenceMessageId` and shows a clearable chip ("Referencing: <first 60 chars>…"); the referenced message is highlighted; the reference persists until cleared or replaced and is sent with each message. Backend: stable message ids, server-side lookup, a PRIMARY REFERENCE system-prompt note, the final user turn wrapped in `<primary_reference>` / `<current_user_message>`, history kept (~12 turns); in form mode, referenced turns are always questions; retrieval uses the referenced topic plus the new message. No reference → behaviour unchanged.

---

### Prompt 8: Share UI

**Goal:** share the filled form and the chat easily and safely. A Share button (Share2) opens a sheet: share filled PDF via `navigator.share({files})` when supported, else download; download PDF; copy a plain-text summary of filled fields; share the chat transcript as text. Mask account numbers, Aadhaar and similar in text shares (XXXX1234); the PDF stays unmasked. Everything client-side, no public links. PDF share/download only after review ("Review your form first"). Toasts on success or failure.

---

### Prompt 9: Final regression pass

Run the full suite and report: transcript replay; router results by intent and language; PDF fill test with PNGs; normalizer tests; the evaluation harness if one exists (flag drops over 2 points); and `git diff --stat` against the baseline confirming no retrieval/KAG/reranker/generator files changed.

---

## Part 5: Manual test checklist

| Test | Expected |
|------|----------|
| Speak "my name is Nithin" in form mode | Box shows the text; nothing sends until you press Send; "Nithin" is saved |
| Speak a Hinglish question mid-form | Answered in Hinglish, scoped to KCC, then one re-ask line |
| Say "skip" | Skips the field currently on screen, never the previous one |
| "i do not know" on "Select one" | Both options explained simply, then re-asked |
| Office-use fields | Never asked |
| Speak "KCC ke liye kaunse documents chahiye" with no form open | Same sources as the typed English version |
| Enter / Shift+Enter / Indic keyboard | Enter sends, Shift+Enter adds a new line, no send mid-composition |
| Reference an answer, then ask "simpler please" | Builds on the referenced answer; chip stays until cleared |
| Generate the PDF with Hindi values | All values visible in the blank spaces; failures shown in review |
| Share on a phone | Native share sheet with the PDF; text shares masked |

---

## Part 6: When things go wrong

- **Claude edits retrieval/KAG files:** "Revert that. Per CLAUDE.md, find a way that doesn't modify <file>."
- **A fix doesn't work:** paste the exact chat, error or screenshot. "This still happens. Investigate why before changing anything."
- **Same failure 2–3 times:** `/clear`, then "Read CLAUDE.md and FORMBOT_FIX_PLAYBOOK.md. Task: Prompt N. We tried X and Y; they failed because Z."
- **Claude claims it's done but you can't reproduce the fix:** "Show me the test that proves it, and the exact manual steps you'd use."
- **Eval metrics drop after a prompt:** `git diff` against the last good commit and ask Claude to explain which change caused it before fixing forward.
