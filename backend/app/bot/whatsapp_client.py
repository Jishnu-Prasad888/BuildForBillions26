"""WhatsApp Cloud API client (Meta Graph API)."""
from __future__ import annotations

import logging

import httpx

from app.config import settings

log = logging.getLogger("whatsapp")

GRAPH = "https://graph.facebook.com"


class WhatsAppClient:
    def __init__(self) -> None:
        self.token = settings.WHATSAPP_TOKEN
        self.phone_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.version = settings.WHATSAPP_GRAPH_VERSION.strip("/") or "v21.0"
        self._url = f"{GRAPH}/{self.version}/{self.phone_id}/messages"
        self._headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    @property
    def enabled(self) -> bool:
        return bool(self.token and self.phone_id)

    async def _post(self, payload: dict) -> None:
        if not self.enabled:
            return
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(self._url, headers=self._headers, json=payload)
            if r.status_code >= 400:
                log.warning("WhatsApp API %s: %s", r.status_code, r.text[:500])

    async def mark_read(self, message_id: str) -> None:
        await self._post({
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
            "typing_indicator": {"type": "text"},
        })

    async def send_text(self, to: str, body: str) -> None:
        from app.bot.formatter import split_message, WA_MAX_LEN
        for chunk in split_message(body, WA_MAX_LEN):
            await self._post({
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"preview_url": False, "body": chunk},
            })

    async def send_buttons(self, to: str, body: str, buttons: list[tuple[str, str]]) -> None:
        """Up to 3 reply buttons. Titles max 20 chars."""
        await self._post({
            "messaging_product": "whatsapp",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body[:1024]},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": bid[:256], "title": title[:20]}}
                        for bid, title in buttons[:3]
                    ]
                },
            },
        })

    async def send_list(self, to: str, body: str, button: str, section_title: str, rows: list[dict]) -> None:
        """List message: each row needs id, title; optional description. Max 10 rows."""
        await self._post({
            "messaging_product": "whatsapp",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "list",
                "body": {"text": body[:1024]},
                "action": {
                    "button": button[:20],
                    "sections": [{
                        "title": section_title[:24],
                        # Empty descriptions are omitted: the API rejects "".
                        "rows": [
                            {"id": r["id"][:200], "title": r["title"][:24]}
                            | ({"description": r["description"][:72]} if r.get("description") else {})
                            for r in rows[:10]
                        ],
                    }],
                },
            },
        })
