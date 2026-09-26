/**
 * Sentry for the browser. Built for a large, low-bandwidth audience and sensitive data:
 *  - Off (and not even downloaded) unless VITE_SENTRY_DSN is set at build time.
 *  - The SDK loads in a separate chunk after the app starts, so it never delays first paint.
 *    Errors raised before it is ready are queued and flushed once it loads.
 *  - No PII: only an opaque user id; URLs lose their query string; ID numbers, phones, emails and
 *    tokens are redacted from messages; clicks/console are not recorded; no session replay.
 *  - Volume: traces are sampled (VITE_SENTRY_TRACES_SAMPLE_RATE, default 2%) and the backend follows
 *    that decision, so one request is one trace across browser and API. Offline/aborted requests and
 *    browser-extension noise are ignored; 4xx API errors are not reported (only 5xx).
 */
type SentryModule = typeof import("@sentry/react");

const DSN = import.meta.env.VITE_SENTRY_DSN;
export const monitoringEnabled = !!DSN;

let sentry: SentryModule | null = null;
const queue: Array<(s: SentryModule) => void> = [];
let pendingUser: string | null = null;
const early: unknown[] = [];
const onEarlyError = (e: ErrorEvent) => early.push(e.error ?? e.message);
const onEarlyRejection = (e: PromiseRejectionEvent) => early.push(e.reason);

const AADHAAR = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;
const PHONE = /(?<!\d)(?:\+?91[ -]?)?[6-9]\d{9}(?!\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const BEARER = /bearer\s+[\w.~+/=-]+/gi;
export const scrubText = (s: string) => s.replace(BEARER, "Bearer [redacted]").replace(EMAIL, "[email]").replace(AADHAAR, "[id-number]").replace(PHONE, "[phone]");
const scrubDeep = (v: unknown): unknown => {
  if (typeof v === "string") return scrubText(v);
  if (Array.isArray(v)) return v.map(scrubDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrubDeep(x)]));
  return v;
};
const stripQuery = (u?: string) => (u ? u.split(/[?#]/)[0] : u);

function run(fn: (s: SentryModule) => void) {
  if (sentry) fn(sentry);
  else if (monitoringEnabled) queue.push(fn);
}

export function initMonitoring() {
  if (!monitoringEnabled) return;
  window.addEventListener("error", onEarlyError);
  window.addEventListener("unhandledrejection", onEarlyRejection);
  import("@sentry/react").then((S) => {
    S.init({
      dsn: DSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
      maxBreadcrumbs: 30,
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.02),
      tracePropagationTargets: [/^\/api\//],
      integrations: [
        S.browserTracingIntegration(),
        S.breadcrumbsIntegration({ dom: false, fetch: true, xhr: true, history: true }),
      ],
      ignoreErrors: [
        "ResizeObserver loop", "Non-Error promise rejection", "AbortError", "The operation was aborted",
        "Failed to fetch", "NetworkError when attempting to fetch", "Load failed", // user is offline / flaky network
      ],
      denyUrls: [/^chrome-extension:/i, /^moz-extension:/i, /^safari-extension:/i, /extensions\//i],
      beforeSend(event) {
        if (event.request) {
          event.request.url = stripQuery(event.request.url);
          delete event.request.query_string;
          delete event.request.cookies;
          delete event.request.headers;
          delete event.request.data;
        }
        event.user = event.user?.id ? { id: event.user.id } : undefined;
        if (event.message) event.message = scrubText(event.message);
        event.exception?.values?.forEach((v) => { if (v.value) v.value = scrubText(v.value); });
        if (event.extra) event.extra = scrubDeep(event.extra) as typeof event.extra;
        return event;
      },
      beforeBreadcrumb(b) {
        if (b.category === "console" || b.category?.startsWith("ui.")) return null; // may contain typed text / names
        if (b.data?.url) b.data.url = stripQuery(String(b.data.url));
        if (b.message) b.message = scrubText(b.message);
        return b;
      },
      beforeSendTransaction(t) {
        if (t.request?.url) t.request.url = stripQuery(t.request.url);
        return t;
      },
    });
    window.removeEventListener("error", onEarlyError);
    window.removeEventListener("unhandledrejection", onEarlyRejection);
    sentry = S;
    if (pendingUser !== null) S.setUser({ id: pendingUser });
    early.splice(0).forEach((e) => S.captureException(e));
    queue.splice(0).forEach((fn) => fn(S));
  }).catch(() => { /* blocked by an ad blocker or offline: monitoring stays off, the app is unaffected */ });
}

/** Tag errors with the signed-in user (opaque id only), or clear it on sign-out. */
export function identifyUser(id: string | null, role?: string) {
  pendingUser = id;
  run((S) => {
    S.setUser(id ? { id } : null);
    S.setTag("role", id ? role ?? "USER" : "anonymous");
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  run((S) => S.captureException(error, context ? { extra: context } : undefined));
}

/** Server faults (5xx) seen from the browser, grouped by route pattern rather than by record id. */
export function reportApiFailure(method: string, path: string, status: number) {
  const route = path.split("?")[0].replace(/\/[0-9a-f]{12,}\b/gi, "/:id").replace(/\/\d+\b/g, "/:id");
  run((S) => S.withScope((scope) => {
    scope.setTag("api.route", `${method} ${route}`);
    scope.setTag("api.status", String(status));
    scope.setFingerprint(["api-5xx", method, route, String(status)]);
    S.captureMessage(`API ${status}: ${method} ${route}`, "error");
  }));
}
