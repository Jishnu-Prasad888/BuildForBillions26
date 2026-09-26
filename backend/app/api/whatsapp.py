"""WhatsApp Cloud API webhook (Meta). GET is the verify handshake; POST is incoming messages."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, Response

from app.config import settings

log = logging.getLogger("whatsapp")
router = APIRouter(tags=["whatsapp"])


def _valid_signature(raw: bytes, header: str) -> bool:
    secret = settings.WHATSAPP_APP_SECRET
    if not secret:
        return True
    expected = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header or "")


@router.get("/api/webhooks/whatsapp")
def verify_webhook(
    mode: str | None = Query(None, alias="hub.mode"),
    token: str | None = Query(None, alias="hub.verify_token"),
    challenge: str | None = Query(None, alias="hub.challenge"),
):
    if mode == "subscribe" and token and token == settings.WHATSAPP_VERIFY_TOKEN and settings.WHATSAPP_VERIFY_TOKEN:
        return Response(content=challenge or "", media_type="text/plain")
    raise HTTPException(403, "WhatsApp webhook verification failed")


@router.post("/api/webhooks/whatsapp")
async def incoming_webhook(request: Request, background_tasks: BackgroundTasks):
    raw = await request.body()
    if not _valid_signature(raw, request.headers.get("x-hub-signature-256", "")):
        raise HTTPException(403, "Invalid WhatsApp signature")
    try:
        payload = json.loads(raw.decode() or "{}")
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON") from None
    if settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID:
        from app.bot.whatsapp_handlers import dispatch_payload
        background_tasks.add_task(dispatch_payload, payload)
    return {"status": "ok"}
