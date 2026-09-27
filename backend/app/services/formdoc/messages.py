"""Chat messages as data, not as strings.

The assistant used to answer with a bag of ``{"kind": "assistant", "text": "..."}`` sections, which meant any
object that reached the right key was rendered as text — an internal icon reference or a model artefact ended
up in the citizen's transcript. Two rules fix that class of bug for good:

1. **Typed messages.** Every message is built here as ``{"type", "content", "metadata"}`` from a known set of
   types. The renderer switches on ``type``; anything unknown is dropped, not printed.
2. **A sanitising boundary.** Text is scrubbed of framework internals (``svgReference``, ``[object Object]``,
   ``useState``, ``Symbol(...)``, ``__proto__`` …), of unbalanced code fences and of stray markup before it can
   reach the browser. The stored transcript goes through the same function, so a leak cannot hide there either.
"""
from __future__ import annotations

import re

# --------------------------------------------------------------------------------------------- message types
FIELD_QUESTION = "field_question"
FIELD_CONFIRMATION = "field_confirmation"
FIELD_EXPLANATION = "field_explanation"
VALIDATION_ERROR = "validation_error"
DOCUMENT_SUMMARY = "document_summary"
PROGRESS = "progress"
KNOWLEDGE = "knowledge"
COMPLETION = "completion"
SYSTEM = "system"
MESSAGE_TYPES = (FIELD_QUESTION, FIELD_CONFIRMATION, FIELD_EXPLANATION, VALIDATION_ERROR, DOCUMENT_SUMMARY,
                 PROGRESS, KNOWLEDGE, COMPLETION, SYSTEM)

#: Internal tokens that must never reach a citizen: UI-framework internals, JS runtime values, model debris.
LEAK_TOKENS = re.compile(
    r"(\bsvgReference\b|\b__svg\w*\b|\buseState\b|\buseRef\b|\buseMemo\b|\buseCallback\b|\bReact\w*Element\b|"
    r"\b_owner\b|\b_fiber\b|\b_stateNode\b|\b__SECRET_INTERNALS\w*\b|\bprops\.\w+\b|\bSymbol\(\w+\)|"
    r"\[object \w+\]|\bundefined\b|\bNaN\b|\bnull\b\s*(?=\||$)|\bfunction\s+\w+\s*\(\s*\)"
    r"|\b[A-Za-z_$][\w$]*\s*:\s*function\b|<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>)")
_FENCE = re.compile(r"```[^\n]*\n?(.*?)```", re.S)
_PARTIAL_FENCE = re.compile(r"```[^\n]*$", re.S)
_TAG = re.compile(r"</?[a-zA-Z][\w-]*(?:\s[^<>]{0,200})*/?>")
_BLANK_RUN = re.compile(r"\n{3,}")


def sanitize(text: object) -> str:
    """Make one value safe to show a citizen. Non-strings become a readable placeholder, never a repr."""
    if text is None:
        return ""
    if not isinstance(text, str):
        return ""  # never render a dict/object: that is how internal objects used to leak into the chat
    s = text.replace("\r\n", "\n").replace("\r", "\n")
    s = _FENCE.sub(r"\1", s)  # drop the fence markers, keep what was inside them
    s = _PARTIAL_FENCE.sub(" ", s)
    s = _TAG.sub(" ", s)
    s = LEAK_TOKENS.sub(" ", s)
    s = _BLANK_RUN.sub("\n\n", s)
    s = re.sub(r"[ \t]+", " ", s)
    return "\n".join(line.rstrip() for line in s.split("\n")).strip()


def message(type: str, content: object, **metadata) -> dict:
    """One typed message. Unknown types are refused so nothing unrenderable is ever sent."""
    if type not in MESSAGE_TYPES:
        raise ValueError(f"unknown message type: {type!r}")
    text = sanitize(content)
    return {"type": type, "content": text, "metadata": {k: v for k, v in metadata.items() if v is not None}}


def assistant_text(type: str, content: object, **metadata) -> dict:
    """Kept for readability at call sites; identical to :func:`message`."""
    return message(type, content, **metadata)


def plain(*messages: dict) -> str:
    """The readable transcript of a reply (used for history, sharing and the re-ask line)."""
    return "\n\n".join(m["content"] for m in messages if m and m.get("content"))


def knowledge_message(content: object, evidence: list | None = None) -> dict:
    m = message(KNOWLEDGE, content)
    if evidence:
        m["evidence"] = evidence
    return m
