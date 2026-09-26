import { ArrowRight, CheckCircle2, ClipboardList, FileText, FolderOpen, MessageCircle, MonitorSmartphone, NotebookPen, Search, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import { useI18n } from "@/i18n";
import type { Application, Note, WalletDoc } from "@/types";
import { EmptyState, ProgressBar, SkeletonList, StatusPill, formatDate } from "@/components/ui";

/** Counts from 0 up to `to` so the home-page numbers tick in on arrival. */
function useCountUp(to: number, ms = 700) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(to);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return n;
}

function Stat({ icon: Icon, value, label, to }: { icon: typeof FileText; value: number | null; label: string; to: string }) {
  const n = useCountUp(value ?? 0);
  return (
    <Link to={to} className="group flex flex-col items-start gap-2 rounded-lg bg-white/70 px-3 py-3 ring-1 sm:flex-row sm:items-center sm:gap-3 sm:px-3.5 ring-paper-300 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lift">
      <span className="hidden h-9 w-9 flex-none items-center justify-center rounded-full bg-forest-50 sm:flex text-forest-700 transition-colors group-hover:bg-forest-800 group-hover:text-white"><Icon size={18} /></span>
      <span className="w-full min-w-0">
        <span className="block font-display text-xl font-bold leading-none text-ink-900">{value === null ? "–" : n}</span>
        <span className="mt-1 block text-xs font-semibold leading-tight text-ink-500 sm:truncate">{label}</span>
      </span>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [docs, setDocs] = useState<WalletDoc[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [ask, setAsk] = useState("");

  // The name gets a one-time wave and shimmer the first time this user reaches home.
  const seenKey = `sahayak.welcomed:${user?.id ?? "user"}`;
  const [firstVisit] = useState(() => {
    try { return !localStorage.getItem(seenKey); } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(seenKey, "1"); } catch { /* private mode: animation just replays */ }
  }, [seenKey]);

  useEffect(() => {
    api.get<Application[]>("/api/applications").then(setApps);
    api.get<WalletDoc[]>("/api/documents").then(setDocs);
    api.get<Note[]>("/api/notes?kind=USER").then(setNotes);
  }, []);

  const inProgress = (apps ?? []).filter((a) => ["IN_PROGRESS", "DRAFT", "DOCUMENTS_REQUIRED"].includes(a.status));
  const resumable = inProgress.find((a) => a.form_id);
  const openTodos = (notes ?? []).filter((n) => n.item_type === "todo" && !n.done);
  const pending = [
    ...(apps ?? []).filter((a) => a.status === "DOCUMENTS_REQUIRED").map((a) => ({ icon: FolderOpen, text: `Upload documents for ${a.scheme_name}`, to: `/applications/${a.id}` })),
    ...inProgress.filter((a) => a.form_id && a.progress < 100).map((a) => ({ icon: ClipboardList, text: `Finish the ${a.scheme_name} form (${a.progress}%)`, to: `/applications/${a.id}/form` })),
    ...inProgress.filter((a) => a.form_id && a.progress >= 100).map((a) => ({ icon: CheckCircle2, text: `Review & confirm ${a.scheme_name}`, to: `/applications/${a.id}/review` })),
    ...openTodos.slice(0, 3).map((n) => ({ icon: NotebookPen, text: n.content, to: "/notes" })),
  ];

  const actions = [
    { icon: Search, title: t("find_scheme"), sub: t("find_scheme_sub"), onClick: () => nav("/schemes") },
    { icon: MonitorSmartphone, title: t("help_fill"), sub: t("help_fill_sub"), onClick: () => nav(resumable ? `/applications/${resumable.id}/form?assist=1` : "/forms") },
    { icon: FolderOpen, title: t("documents"), sub: t("documents_sub"), onClick: () => nav("/documents") },
  ];

  const submitAsk = (e: FormEvent) => {
    e.preventDefault();
    nav(ask.trim() ? `/assistant?q=${encodeURIComponent(ask.trim())}` : "/assistant");
  };

  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero: greeting, one obvious way to ask for help, and a snapshot of where things stand. */}
      <section className="greet-surface relative overflow-hidden rounded-2xl border border-paper-300 p-5 shadow-card sm:p-8">
        <Sparkles size={120} className="pointer-events-none absolute -right-4 -top-4 hidden animate-float text-forest-100 sm:block" aria-hidden />
        <div className="relative">
          <div className="eyebrow animate-riseIn">{t("welcome_back")}</div>
          <h1 className="mt-1 font-display text-[1.9rem] font-bold leading-tight sm:text-[2.5rem]">
            <span className="inline-block animate-riseIn" style={{ animationDelay: "80ms" }}>{t("hello")},</span>{" "}
            <span className={firstVisit
              ? "inline-block animate-greet bg-[linear-gradient(90deg,#0f4a37_30%,#2fbf85_50%,#0f4a37_70%)] bg-[length:200%_100%] bg-clip-text text-transparent"
              : "inline-block animate-riseIn text-forest-800"} style={firstVisit ? undefined : { animationDelay: "150ms" }}>
              {firstName}
            </span>{" "}
            <span className={`inline-block origin-[70%_70%] ${firstVisit ? "animate-wave" : ""}`} aria-hidden>👋</span>
          </h1>
          <p className="mt-2 animate-riseIn text-lg text-ink-600" style={{ animationDelay: "250ms" }}>{t("what_help")}</p>

          <form onSubmit={submitAsk} className="mt-5 flex max-w-2xl animate-riseIn flex-col gap-2 sm:flex-row" style={{ animationDelay: "350ms" }}>
            <div className="relative flex-1">
              <MessageCircle size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-600" aria-hidden />
              <input className="input min-h-[52px] rounded-lg pl-11 shadow-sm" value={ask} onChange={(e) => setAsk(e.target.value)}
                placeholder={t("ask_home_placeholder")} aria-label={t("talk_assistant")} />
            </div>
            <button className="btn-primary btn-lg group rounded-lg">
              {t("talk_assistant")} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          <div className="mt-6 grid animate-riseIn grid-cols-3 gap-2 sm:max-w-2xl sm:gap-2.5" style={{ animationDelay: "450ms" }}>
            <Stat icon={FileText} value={apps && inProgress.length} label={t("in_progress")} to="/applications" />
            <Stat icon={FolderOpen} value={docs && docs.length} label={t("in_wallet")} to="/documents" />
            <Stat icon={NotebookPen} value={notes && openTodos.length} label={t("to_do")} to="/notes" />
          </div>
        </div>
      </section>

      {/* Continue: the single most useful next click, when there is one. */}
      {resumable && (
        <Link to={`/applications/${resumable.id}/form`}
          className="group flex animate-riseIn flex-col gap-4 rounded-xl border border-forest-800 bg-forest-800 p-5 text-white shadow-lift transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center" style={{ animationDelay: "500ms" }}>
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/10"><ClipboardList size={22} className="text-forest-200" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-[0.08em] text-forest-200">{t("continue_where")}</span>
            <span className="mt-0.5 block text-lg font-semibold">{resumable.scheme_name}</span>
            <span className="mt-2 flex items-center gap-3">
              <span className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full bg-forest-300 transition-all duration-700" style={{ width: `${resumable.progress}%` }} />
              </span>
              <span className="text-sm font-semibold text-forest-100">{resumable.progress}%</span>
            </span>
          </span>
          <span className="btn bg-white text-forest-800 group-hover:bg-forest-50">{t("continue_app")} <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></span>
        </Link>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-ink-500">{t("more_ways")}</h2>
        <div className="stagger grid gap-3 sm:grid-cols-3">
          {actions.map(({ icon: Icon, title, sub, onClick }) => (
            <button key={title} onClick={onClick}
              className="group flex items-center gap-3.5 rounded-lg border border-paper-300 bg-white p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-lift">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-forest-50 text-forest-700 transition-all group-hover:scale-105 group-hover:bg-forest-800 group-hover:text-white"><Icon size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug text-ink-900">{title}</span>
                <span className="block truncate text-sm text-ink-500">{sub}</span>
              </span>
              <ArrowRight size={18} className="flex-none text-ink-300 transition-all group-hover:translate-x-1 group-hover:text-forest-700" />
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("active_apps")}</h2>
            <Link to="/applications" className="text-sm font-semibold text-forest-700 hover:text-forest-900">All →</Link>
          </div>
          {apps === null ? <SkeletonList rows={3} /> : apps.length === 0 ? (
            <EmptyState icon={<FileText size={22} />} title="No applications yet">Ask the assistant about your situation to get started.</EmptyState>
          ) : (
            <div className="stagger space-y-3">
              {apps.slice(0, 3).map((a) => (
                <Link key={a.id} to={`/applications/${a.id}`} className="card-link p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-900">{a.scheme_name}</div>
                      <div className="text-sm text-ink-500">{a.reference_number ? `Ref ${a.reference_number}` : `Started ${formatDate(a.created_at)}`}</div>
                    </div>
                    <StatusPill status={a.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-3"><ProgressBar value={a.progress} /><span className="w-10 text-right text-sm font-semibold text-ink-600">{a.progress}%</span></div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">{t("next_steps")}</h2>
          <div className="card p-2">
            {apps === null ? <div className="p-2"><SkeletonList rows={3} className="h-9" /></div> : pending.length === 0 ? (
              <p className="flex items-center gap-2 p-3 text-sm text-ink-500"><CheckCircle2 size={18} className="text-leaf" /> {t("all_caught_up")}</p>
            ) : (
              <ul className="stagger">
                {pending.slice(0, 5).map((p, i) => (
                  <li key={i}>
                    <Link to={p.to} className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.95rem] text-ink-800 transition-colors hover:bg-forest-50">
                      <p.icon size={17} className="flex-none text-forest-600" />
                      <span className="min-w-0 flex-1">{p.text}</span>
                      <ArrowRight size={15} className="flex-none text-ink-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
