"""Sentry error and performance monitoring, built to stay cheap and private at high traffic.

Off unless SENTRY_DSN is set. Design choices for a service handling citizens' identity documents:

* No PII: `send_default_pii=False`, request bodies / headers / cookies / query strings are removed,
  stack-frame local variables are not captured, and anything that looks like an Aadhaar, phone
  number, email or bearer token is redacted from messages and breadcrumbs. Users are identified by
  opaque id only.
* Volume control: traces are sampled (SENTRY_TRACES_SAMPLE_RATE, default 5%), health checks and
  CORS preflights are never traced, expected client errors (4xx, rate limits) are not reported, and
  repeated identical failures are collapsed by Sentry's fingerprinting.
* Every replica reports with the same `environment` and `release`, plus a `server_name` tag from
  the container hostname, so a bad deploy or a single sick replica shows up immediately.
"""
from __future__ import annotations

import logging
import re

from app.config import settings

log = logging.getLogger(__name__)

_AADHAAR = re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b")
_PHONE = re.compile(r"(?<!\d)(?:\+?91[ -]?)?[6-9]\d{9}(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_BEARER = re.compile(r"(?i)bearer\s+[\w.~+/=-]+")
_QUIET_PATHS = ("/api/health", "/api/ready", "/favicon.ico")
_DROP_LOGGERS = {"ratelimit", "uvicorn.access", "httpx", "httpcore"}


def scrub_text(value: str) -> str:
    value = _BEARER.sub("Bearer [redacted]", value)
    value = _EMAIL.sub("[email]", value)
    value = _AADHAAR.sub("[id-number]", value)
    return _PHONE.sub("[phone]", value)


def _scrub(obj):
    if isinstance(obj, str):
        return scrub_text(obj)
    if isinstance(obj, dict):
        return {k: _scrub(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_scrub(v) for v in obj]
    return obj


def before_send(event: dict, hint: dict) -> dict | None:
    if event.get("logger") in _DROP_LOGGERS:
        return None
    req = event.get("request")
    if req:
        for key in ("data", "cookies", "headers", "query_string"):
            req.pop(key, None)
        if req.get("url"):
            req["url"] = req["url"].split("?", 1)[0]
    event["user"] = {"id": (event.get("user") or {}).get("id")} if (event.get("user") or {}).get("id") else {}
    for key in ("message", "logentry", "exception", "breadcrumbs", "extra", "contexts"):
        if key in event:
            event[key] = _scrub(event[key])
    return event


def before_breadcrumb(crumb: dict, hint: dict) -> dict | None:
    if crumb.get("category") in ("httplib", "httpx") and "data" in crumb:
        crumb["data"] = {k: v for k, v in crumb["data"].items() if k in ("status_code", "method", "reason")}
    return _scrub(crumb)


def traces_sampler(ctx: dict) -> float:
    path = (ctx.get("asgi_scope") or {}).get("path", "")
    if path.startswith(_QUIET_PATHS):
        return 0.0
    if ctx.get("parent_sampled") is not None:  # honour the frontend's decision so traces stay end to end
        return 1.0 if ctx["parent_sampled"] else 0.0
    return settings.SENTRY_TRACES_SAMPLE_RATE


def init_sentry() -> bool:
    if not settings.SENTRY_DSN:
        return False
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT or settings.APP_ENV,
        release=settings.SENTRY_RELEASE or None,
        server_name=settings.SENTRY_SERVER_NAME or None,
        send_default_pii=False,
        include_local_variables=False,
        max_breadcrumbs=30,
        traces_sampler=traces_sampler,
        profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
        before_send=before_send,
        before_breadcrumb=before_breadcrumb,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),  # group by route, never by URL with ids
            SqlalchemyIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),  # log.exception() -> event
        ],
        # Client mistakes and load shedding are expected, not incidents.
        ignore_errors=["KeyboardInterrupt", "CancelledError"],
    )
    log.info("Sentry enabled (env=%s, traces=%s)", settings.SENTRY_ENVIRONMENT or settings.APP_ENV, settings.SENTRY_TRACES_SAMPLE_RATE)
    return True


def identify(user_id: str, role: str) -> None:
    """Attach the signed-in user (opaque id + role only) to any error raised while serving this request."""
    if not settings.SENTRY_DSN:
        return
    import sentry_sdk

    sentry_sdk.set_user({"id": user_id})
    sentry_sdk.set_tag("role", role)
