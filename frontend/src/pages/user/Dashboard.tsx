import { ArrowRight, ClipboardList, FileText, FolderOpen, MessageCircle, MonitorSmartphone, Search, StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import { useI18n } from "@/i18n";
import type { Application, Note, WalletDoc } from "@/types";
import { EmptyState, ProgressBar, StatusPill, formatDate } from "@/components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [docs, setDocs] = useState<WalletDoc[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    api.get<Application[]>("/api/applications").then(setApps);
    api.get<WalletDoc[]>("/api/documents").then(setDocs);
    api.get<Note[]>("/api/notes?kind=USER").then(setNotes);
  }, []);

  const inProgress = apps.filter((a) => ["IN_PROGRESS", "DRAFT", "DOCUMENTS_REQUIRED"].includes(a.status));
  const resumable = inProgress.find((a) => a.form_id);
  const pending = [
    ...apps.filter((a) => a.status === "DOCUMENTS_REQUIRED").map((a) => ({ text: `Upload documents for ${a.scheme_name}`, to: `/applications/${a.id}` })),
    ...inProgress.filter((a) => a.form_id && a.progress < 100).map((a) => ({ text: `Finish the ${a.scheme_name} form (${a.progress}%)`, to: `/applications/${a.id}/form` })),
    ...inProgress.filter((a) => a.form_id && a.progress >= 100).map((a) => ({ text: `Review & confirm ${a.scheme_name}`, to: `/applications/${a.id}/review` })),
    ...notes.filter((n) => n.item_type === "todo" && !n.done).slice(0, 3).map((n) => ({ text: n.content, to: "/notes" })),
  ];

  const actions = [
    { icon: MessageCircle, title: t("talk_assistant"), sub: t("talk_assistant_sub"), onClick: () => nav("/assistant"), primary: true },
    { icon: Search, title: t("find_scheme"), sub: t("find_scheme_sub"), onClick: () => nav("/schemes") },
    { icon: MonitorSmartphone, title: t("help_fill"), sub: t("help_fill_sub"), onClick: () => nav(resumable ? `/applications/${resumable.id}/form?assist=1` : "/schemes?form=1") },
    { icon: ClipboardList, title: t("continue_app"), sub: resumable ? `${resumable.scheme_name} · ${resumable.progress}%` : t("continue_app_sub"), onClick: () => nav(resumable ? `/applications/${resumable.id}/form` : "/applications") },
  ];

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <div className="eyebrow">{t("welcome_back")}</div>
        <h1 className="font-display text-[1.75rem] font-bold leading-tight sm:text-[2.2rem]">{user?.full_name?.split(" ")[0]}, {t("what_help").charAt(0).toLowerCase() + t("what_help").slice(1)}</h1>
      </div>

      {/* Phones: one compact row per action. Wider screens: a row of tall tiles. */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {actions.map(({ icon: Icon, title, sub, onClick, primary }) => (
          <button key={title} onClick={onClick}
            className={`group flex items-center gap-4 rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lift sm:flex-col sm:items-start sm:p-5 ${primary ? "border-ink-800 bg-forest-800 text-white" : "border-paper-300 bg-white"}`}>
            <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-lg sm:mb-1 ${primary ? "bg-saffron text-white" : "bg-saffron-50 text-saffron-700"}`}>
              <Icon size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-lg font-semibold leading-snug ${primary ? "text-white" : "text-ink-900"}`}>{title}</span>
              <span className={`mt-0.5 block text-sm ${primary ? "text-ink-200" : "text-ink-600"}`}>{sub}</span>
            </span>
            <ArrowRight size={20} className={`flex-none transition-transform group-hover:translate-x-1 sm:mt-auto ${primary ? "text-saffron" : "text-ink-400"}`} />
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("active_apps")}</h2>
            <Link to="/applications" className="text-sm font-semibold text-ink-600 hover:text-ink-900">All applications →</Link>
          </div>
          <div className="space-y-3">
            {apps.length === 0 && <EmptyState icon={<FileText />} title="No applications yet">Ask the assistant about your situation to get started.</EmptyState>}
            {apps.slice(0, 4).map((a) => (
              <Link key={a.id} to={`/applications/${a.id}`} className="card-link p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-900">{a.scheme_name}</div>
                    <div className="text-sm text-ink-500">{a.reference_number ? `Ref ${a.reference_number}` : `Started ${formatDate(a.created_at)}`}{a.next_section && a.progress < 100 ? ` · Next: ${a.next_section}` : ""}</div>
                  </div>
                  <StatusPill status={a.status} />
                </div>
                <div className="mt-3 flex items-center gap-3"><ProgressBar value={a.progress} /><span className="w-10 text-right text-sm font-semibold text-ink-600">{a.progress}%</span></div>
              </Link>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">{t("pending_actions")}</h2>
            {pending.length === 0 ? <p className="text-sm text-ink-500">You're all caught up.</p> : (
              <ul className="space-y-2">
                {pending.slice(0, 5).map((p, i) => (
                  <li key={i}><Link to={p.to} className="flex items-start gap-2 text-[0.95rem] text-ink-800 hover:text-ink-900"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-saffron" />{p.text}</Link></li>
                ))}
              </ul>
            )}
          </section>
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("recent_docs")}</h2>
              <Link to="/documents" className="text-sm font-semibold text-ink-600">Wallet →</Link>
            </div>
            {docs.length === 0 ? <p className="text-sm text-ink-500">No documents uploaded.</p> : (
              <ul className="space-y-2">{docs.slice(0, 4).map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-[0.95rem]"><FolderOpen size={16} className="text-ink-400" />{d.title}</li>
              ))}</ul>
            )}
          </section>
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("recent_notes")}</h2>
              <Link to="/notes" className="text-sm font-semibold text-ink-600">All notes →</Link>
            </div>
            {notes.length === 0 ? <p className="text-sm text-ink-500">No notes yet.</p> : (
              <ul className="space-y-2">{notes.slice(0, 4).map((n) => (
                <li key={n.id} className={`flex items-start gap-2 text-[0.95rem] ${n.done ? "text-ink-400 line-through" : ""}`}><StickyNote size={16} className="mt-0.5 flex-none text-saffron-600" />{n.content}</li>
              ))}</ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
