"""Reference resolution for the "Reference" button on assistant messages.

When a user pins an assistant message, the next question builds on that answer.
The referenced message's text goes into extra_context; its key terms go into extra_query.
No field values can appear here: only text the LLM generated (already redacted).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

log = logging.getLogger("reference")

_STOP = set("the a an of to for and or in on is are be your you my i do does what how when where can with at by it this that will shall may".split())


@dataclass
class ResolvedReference:
    message_id: str
    context: str   # injected into extra_context
    topic: str     # injected into extra_query


def resolve(message_id: str | None, reference_text: str | None, db: Session | None) -> ResolvedReference | None:
    """Look up a message by id (owned by the user), returning context and topic strings.

    ``reference_text`` is used as a fallback when no DB is passed or when the
    message cannot be found (e.g. a very old conversation not yet in history).
    Returns None when no reference is given.
    """
    if message_id is None and reference_text is None:
        return None

    content: str | None = None

    if message_id is not None and db is not None:
        from app.models.conversation import Message

        msg = db.get(Message, message_id)
        if msg is not None and msg.role == "assistant":
            content = msg.content

    if content is None:
        content = reference_text or ""

    if not content:
        return None

    # Build a short topic from the most content-bearing words (for extra_query).
    words = [w for w in re.findall(r"\b[A-Za-z]{3,}\b", content) if w.lower() not in _STOP]
    topic = " ".join(dict.fromkeys(words[:12]))  # deduplicated, preserve order

    # The context note is length-capped: the LLM already saw it in history.
    context = f"PRIMARY REFERENCE — the citizen is asking a follow-up about this answer:\n\n{content[:600]}"

    return ResolvedReference(message_id=message_id or "", context=context, topic=topic)


def ownership_ok(message_id: str, user_id: str, db: Session) -> bool:
    """Return True only if the message belongs to a conversation owned by user_id."""
    from sqlalchemy import select
    from app.models.conversation import Conversation, Message

    msg = db.get(Message, message_id)
    if msg is None:
        return False
    conv = db.get(Conversation, msg.conversation_id)
    return conv is not None and conv.user_id == user_id
