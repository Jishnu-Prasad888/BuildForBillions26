"""Request rate limiting with GCRA (Generic Cell Rate Algorithm).

GCRA behaves like a token bucket (a burst is allowed, then a steady rate) but stores a single
timestamp per client — the "theoretical arrival time" (TAT) — so each check is one atomic
read-modify-write. With REDIS_URL set, state lives in Redis and is shared by every API replica;
the Lua script uses Redis' clock so replicas with skewed clocks still agree. Without Redis the
state is per process, which is only suitable for a single-process deployment.

Clients are identified by user id (from a valid bearer token) and otherwise by IP address.
IP limits are kept generous because many mobile users share one carrier-grade NAT address.
"""
from __future__ import annotations

import json
import logging
import math
import re
import time
from dataclasses import dataclass

from app.auth.security import decode_access_token
from app.config import settings

log = logging.getLogger("ratelimit")

_PERIODS = {"s": 1, "sec": 1, "second": 1, "m": 60, "min": 60, "minute": 60, "h": 3600, "hour": 3600}


@dataclass(frozen=True)
class Rule:
    name: str
    count: int
    period: float
    burst: int
    by_ip: bool = False  # always key by IP (e.g. sign-in, where there is no user yet)

    @property
    def interval(self) -> float:  # seconds between requests at the steady rate
        return self.period / self.count

    @property
    def tolerance(self) -> float:  # how far ahead of schedule a client may run (the burst)
        return self.interval * (self.burst - 1)


def parse_rule(name: str, spec: str, by_ip: bool = False) -> Rule:
    """'20/minute' or '20/minute:8' (8 = burst size; defaults to the count)."""
    m = re.fullmatch(r"\s*(\d+)\s*/\s*([a-z]+)\s*(?::\s*(\d+))?\s*", spec.lower())
    if not m or m.group(2) not in _PERIODS or int(m.group(1)) < 1:
        raise ValueError(f"Invalid rate limit for {name}: {spec!r} (expected e.g. '20/minute:8')")
    count = int(m.group(1))
    return Rule(name, count, float(_PERIODS[m.group(2)]), max(1, int(m.group(3) or count)), by_ip)


@dataclass
class Decision:
    allowed: bool
    rule: Rule
    remaining: int
    reset_after: float  # seconds until the client is back to a full burst
    retry_after: float  # seconds until the next request would be allowed (0 if allowed)


def _decide(rule: Rule, now: float, stored_tat: float | None) -> tuple[Decision, float | None]:
    tat = max(stored_tat if stored_tat is not None else now, now)
    if now < tat - rule.tolerance:
        return Decision(False, rule, 0, tat - now, tat - rule.tolerance - now), None
    new_tat = tat + rule.interval
    remaining = max(0, math.floor((now + rule.tolerance - new_tat) / rule.interval + 1e-9) + 1)
    return Decision(True, rule, remaining, new_tat - now, 0.0), new_tat


class MemoryStore:
    def __init__(self) -> None:
        self._tat: dict[str, float] = {}

    async def hit(self, key: str, rule: Rule) -> Decision:
        now = time.monotonic()
        if len(self._tat) > 50_000:
            self._tat = {k: v for k, v in self._tat.items() if v > now}
        decision, new_tat = _decide(rule, now, self._tat.get(key))
        if new_tat is not None:
            self._tat[key] = new_tat
        return decision


_GCRA_LUA = """
local t = redis.call('TIME')
local now = tonumber(t[1]) + tonumber(t[2]) / 1000000
local interval, tolerance = tonumber(ARGV[1]), tonumber(ARGV[2])
local tat = tonumber(redis.call('GET', KEYS[1])) or now
if tat < now then tat = now end
if now < tat - tolerance then
  return {0, tostring(tat - now), tostring(tat - tolerance - now)}
end
local new_tat = tat + interval
redis.call('SET', KEYS[1], string.format('%.6f', new_tat), 'PX', math.ceil((new_tat - now) * 1000))
return {1, tostring(new_tat - now), '0'}
"""


class RedisStore:
    def __init__(self, url: str) -> None:
        import redis.asyncio as redis

        self._redis = redis.from_url(url, socket_timeout=0.5, socket_connect_timeout=0.5)
        self._script = self._redis.register_script(_GCRA_LUA)

    async def hit(self, key: str, rule: Rule) -> Decision:
        allowed, reset_after, retry_after = await self._script(keys=[key], args=[rule.interval, rule.tolerance])
        reset_after, retry_after = float(reset_after), float(retry_after)
        remaining = 0 if not allowed else max(0, math.floor((rule.tolerance - reset_after) / rule.interval + 1e-9) + 1)
        return Decision(bool(int(allowed)), rule, remaining, reset_after, retry_after)


AUTH_PATHS = re.compile(r"^/api/auth/(signin|signup|forgot-password|reset-password)$")
AI_PATHS = re.compile(r"^/api/(assistant/chat|kag/query|screen-assistance/sessions(/[^/]+/messages)?)$")
UPLOAD_PATHS = re.compile(r"^/api/(documents|applications/[^/]+/documents|admin/(documents|sources|reembed))$")
EXEMPT_PATHS = re.compile(r"^/api/(health(/.*)?|webhooks/whatsapp)$")


class RateLimiter:
    def __init__(self) -> None:
        self.default = parse_rule("default", settings.RATE_LIMIT_DEFAULT)
        self.auth = parse_rule("auth", settings.RATE_LIMIT_AUTH, by_ip=True)
        self.ai = parse_rule("ai", settings.RATE_LIMIT_AI)
        self.upload = parse_rule("upload", settings.RATE_LIMIT_UPLOAD)
        self.store = RedisStore(settings.REDIS_URL) if settings.REDIS_URL else MemoryStore()
        self.backend = "redis" if settings.REDIS_URL else "memory"
        self._last_error_log = 0.0

    def rules_for(self, method: str, path: str) -> list[Rule]:
        if not path.startswith("/api/") or EXEMPT_PATHS.match(path) or method == "OPTIONS":
            return []
        rules = []
        if method == "POST":
            if AUTH_PATHS.match(path):
                rules.append(self.auth)
            elif AI_PATHS.match(path):
                rules.append(self.ai)
            elif UPLOAD_PATHS.match(path):
                rules.append(self.upload)
        return [*rules, self.default]

    async def check(self, rules: list[Rule], user_id: str | None, ip: str) -> list[Decision]:
        """Evaluates the most specific rule first and stops at the first denial, so a rejected
        request doesn't also consume the client's general allowance."""
        decisions = []
        for rule in rules:
            who = f"ip:{ip}" if rule.by_ip or not user_id else f"user:{user_id}"
            try:
                d = await self.store.hit(f"rl:{rule.name}:{who}", rule)
            except Exception as exc:  # noqa: BLE001 — fail open: an outage must not take the API down
                if time.monotonic() - self._last_error_log > 30:
                    log.warning("Rate limit store unavailable, allowing request: %s", exc)
                    self._last_error_log = time.monotonic()
                return []
            decisions.append(d)
            if not d.allowed:
                break
        return decisions


def _user_id(headers: dict[bytes, bytes]) -> str | None:
    auth = headers.get(b"authorization", b"").decode("latin-1")
    if not auth.lower().startswith("bearer "):
        return None
    try:
        return str(decode_access_token(auth[7:].strip())["sub"])
    except Exception:  # noqa: BLE001 — invalid/expired tokens are limited by IP; auth rejects them later
        return None


def _headers(d: Decision) -> list[tuple[bytes, bytes]]:
    h = [(b"ratelimit-limit", str(d.rule.burst).encode()), (b"ratelimit-remaining", str(d.remaining).encode()),
         (b"ratelimit-reset", str(math.ceil(d.reset_after)).encode())]
    if not d.allowed:
        h.append((b"retry-after", str(max(1, math.ceil(d.retry_after))).encode()))
    return h


class RateLimitMiddleware:
    """Pure ASGI middleware (keeps streaming responses and background tasks untouched)."""

    def __init__(self, app, limiter: RateLimiter | None = None) -> None:
        self.app = app
        self.limiter = limiter or get_limiter()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not settings.RATE_LIMIT_ENABLED:
            return await self.app(scope, receive, send)
        rules = self.limiter.rules_for(scope["method"], scope["path"])
        if not rules:
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers") or [])
        ip = (scope.get("client") or ("unknown", 0))[0]
        decisions = await self.limiter.check(rules, _user_id(headers), ip)
        if not decisions:
            return await self.app(scope, receive, send)
        last = decisions[-1]
        if not last.allowed:
            wait = max(1, math.ceil(last.retry_after))
            body = json.dumps({"detail": f"Too many requests. Please wait {wait} second{'s' if wait != 1 else ''} and try again."}).encode()
            await send({"type": "http.response.start", "status": 429,
                        "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), *_headers(last)]})
            await send({"type": "http.response.body", "body": body})
            return
        tightest = min(decisions, key=lambda d: d.remaining)

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                message = {**message, "headers": [*message.get("headers", []), *_headers(tightest)]}
            await send(message)

        await self.app(scope, receive, send_with_headers)


_limiter: RateLimiter | None = None


def get_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter()
    return _limiter
