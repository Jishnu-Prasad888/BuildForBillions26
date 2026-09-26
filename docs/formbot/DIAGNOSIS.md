# FormBot diagnosis (Playbook Prompt 1)

Investigation only; line numbers are from commit `b6b583c`. Evidence transcript:
`backend/tests/fixtures/kcc_transcript.txt` (reconstructed from the bug list until the real chat is supplied).

## Path from "send" to a saved value

1. `frontend/src/components/formassist/AssistantDock.tsx:43-61` `send()` posts
   `{message, current_field_id: fieldId ?? fieldRef.current, …}` to `POST /api/forms/{id}/assistant`.
   `fieldRef.current` mirrors the `currentFieldId` prop (`:40-41`).
2. That prop is `FormWorkspace.tsx`'s `current` state (`:28`), changed by `select()` (`:65-71`, when the user clicks a
   field in the preview or AutoFill panel) and by `onAssistantResponse` (`:73-83`).
3. `backend/app/api/forms.py:244-250` → `FormAssistant.handle(message, current_field_id, …)`.
4. `backend/app/services/formdoc/assistant.py:129-168` decides what the message is and which field it targets, then
   `_store` (`:171-186`) validates with `values.validate_value` and saves via `service.set_value`.
5. `_finish_reply` (`:86-113`) picks the next field with `service.next_missing(after=…)`, stores it in
   `state["asking"]`, and appends the next question.

## Root causes

### Bug 6: answer to "To" saved to "Branch"; "Skip" skipped the wrong field (off-by-one)

Two pointers exist and the client's wins:

- **Server** keeps `state["asking"]` (`assistant.py:93, 105`).
- **Client** keeps `current` in `FormWorkspace.tsx`, and it is updated late: `onAssistantResponse` only calls
  `setCurrent(r.ask.field_id)` inside `loadSchema().then(...)` (`FormWorkspace.tsx:76-81`), i.e. after an extra
  network round trip. Until that resolves, `fieldRef.current` still holds the *previous* field.
- `handle` resolves the target as `self.by_id.get(current_field_id) or self.by_id.get(self.state["asking"])`
  (`assistant.py:150`): a stale client id is preferred over the server's own pointer.

So a reply sent before the reload finishes — very likely with voice, which auto-sends on the final result
(`AssistantDock.tsx:81`) — is saved to "Branch" while "To" is displayed. "Skip" takes the same path
(`assistant.py:154-157`) and skips "Branch". The same thing happens after the user merely *clicks* a field in the preview:
`select()` sets `current`, and every later answer goes to that field regardless of what the bot is asking.

### Bug 5: Hindi question saved as the "Branch" value

`handle` treats every message as an answer unless `QUESTION_RE` matches (`assistant.py:147`). `QUESTION_RE`
(`:27`) only knows `?` and English question words at the *start* of the message. "Bhaai mujhe account number kaisa
janana padega ismein" has neither, so it falls through to `_store` (`:168`). "Branch" is a `text` field, and
`validate_value` accepts any text (`values.py:348`), so the question is saved as the value.

### Bug 1: "my name is Nithin" saved verbatim

There is no value-extraction step. `_store` passes the raw message to `validate_value` (`assistant.py:173`), which for
`text`/`name` fields only normalises whitespace (`values.py:344-348`). Typed-number fields survive only because their
validators strip non-digits.

### Bug 7: "i do not know" on "Select one" just skipped

`SKIP_RE` (`assistant.py:28`) includes "i do not know", "don't know", "not sure" and "no idea", so they are handled
as skip (`:154-157`). There is no `dont_know` path that explains the field or its options.

### Bug 8: "70 office use" asked

Nothing filters office-only fields. `analyze.py` and `detect.py` keep every detected label, and `service.next_missing`
(`service.py:68-78`) asks every field whose status is `missing`.

### Bug 3: every question reply starts with "FORM OBSERVATION"

`_answer_question` always prepends `_observe(focus)` as a `form_observation` section (`assistant.py:336-338`;
template at `:289-302`), and `AssistantDock.tsx:27-31` renders it with a "FORM OBSERVATION" tag. `focus` is the
client's `current_field_id` (`_focus_field`, `:275-277`), so with a stale pointer it even describes the wrong field.

### Bug 4: account-number question answered with PMFBY

`_answer_question` calls `agent.answer(db, query, …, extra_context=ctx, extra_query=focus["label"])`
(`assistant.py:346-349`) without `context_schemes`, so retrieval is not scoped to the form's scheme. The knowledge
base is dominated by crop documents, and the query is anchored to the (stale) focus label ("Branch"), so crop-insurance
chunks win. The bot's own prompt text is not added to the query in this code path; the pollution is the stale label.

### Bug 2: values not appearing in the PDF

`fill.py` already uses AcroForm widgets first (`:85-112`), draws into the detected value bbox (not the label), converts
OCR pixels to points upstream (`analyze.py:227, 262-263`), retries smaller sizes when text doesn't fit (`:62-70`) and
reports it (`:174-175`), and keys values by field id. The real gap is fonts:

- `_unicode_font` (`fill.py:35-39`) picks **one** font for every script from `_FONT_CANDIDATES` (`:22-28`). The first
  candidate, Noto Sans Regular, has no Devanagari or Kannada glyphs, so Hindi/Kannada values would draw as blanks.
- The backend image installs no fonts at all (`backend/Dockerfile`), so in Docker `_unicode_font()` returns `None`
  and every non-Latin value is skipped with a warning (`fill.py:168-171`).
- Warnings are returned by `generate` but not shown on the review screen before download.

### Bug 9: voice auto-sends; separate inputs per mode

`useSpeechInput(lang, onFinal)` calls `onFinal` on the final recognition result (`useSpeech.ts:66-83`), and all three
chat surfaces pass `send` as `onFinal`: `Assistant.tsx:57`, `AssistantDock.tsx:81`, `AssistPanel.tsx:60`. Each surface
has its own input + mic + send markup. Voice already exists in Q&A and form modes; the problem is auto-send and the
duplicated inputs.
