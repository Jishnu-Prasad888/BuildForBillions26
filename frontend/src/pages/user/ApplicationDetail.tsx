import { ArrowLeft, Bot, CheckCircle2, Circle, ExternalLink, FileCheck2, FileX2, Sparkles, User as UserIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { AINotes, ApplicationDetail as AD, Note } from "@/types";
import { AINotesPanel, UserNotesPanel } from "@/components/Notes";
import { EvidenceList } from "@/components/Evidence";
import Markdown from "@/components/Markdown";
import StatusSteps from "@/components/apps/StatusSteps";
import { LoadError, Skeleton } from "@/components/apps/Skeleton";
import { isActive, nextAction } from "@/components/apps/status";
import { EmptyState, ProgressBar, StatusPill, Tabs, formatDate } from "@/components/ui";
import { displayValue, fieldLabel, isFilled } from "@/components/formUtils";

type Tab = "overview" | "answers" | "documents" | "activity";

function DetailSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-32" />
      <div className="card space-y-4 p-6"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10 w-full" /></div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const { lang, t } = useI18n();
  const [app, setApp] = useState<AD | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [notes, setNotes] = useState<Note[]>([]);

  const load = useCallback(() => {
    setError(null);
    return api.get<AD>(`/api/applications/${id}`).then((a) => {
      setApp(a);
      setNotes(a.user_notes);
    }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { setApp(null); load(); }, [load]);

  if (error && !app) return <LoadError message={error} onRetry={load} />;
  if (!app) return <DetailSkeleton />;

  const editable = isActive(app);
  const na = nextAction(app);
  // For portal applications the primary action would point back at this page, so offer the portal itself.
  const portalUrl = app.scheme?.portal?.url;
  const primaryHere = na.to === `/applications/${id}`;
  const attachedCodes = new Set(app.documents.map((d) => d.requirement_code));
  const walletTypes = new Set(app.wallet.map((w) => w.doc_type));
  const required = app.scheme?.documents ?? [];
  const isReady = (d: (typeof required)[number]) => attachedCodes.has(d.code) || d.wallet_types.some((w) => walletTypes.has(w));
  const readyCount = required.filter(isReady).length;

  const attach = async (reqCode: string, docId: string) => {
    await api.post(`/api/applications/${id}/documents`, { user_document_id: docId, requirement_code: reqCode });
    load();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(app.form ? [{ id: "answers" as Tab, label: "Form answers" }] : []),
    { id: "documents", label: `${t("documents")}${required.length ? ` (${readyCount}/${required.length})` : ""}` },
    { id: "activity", label: "Notes & activity" },
  ];

  return (
    <div>
      <Link to="/applications" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-900"><ArrowLeft size={15} /> {t("applications")}</Link>

      <section className="card mb-6 overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 basis-72">
              <div className="eyebrow mb-1">{app.reference_number ? `Reference ${app.reference_number}` : app.form_id ? "Guided form" : "Portal application"}</div>
              <h1 className="font-display text-[1.65rem] font-bold leading-tight sm:text-[1.9rem]">{app.scheme_name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
                <StatusPill status={app.status} />
                <span>Started {formatDate(app.created_at)}</span>
                <span>Updated {formatDate(app.updated_at)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!primaryHere && <Link to={na.to} className="btn-primary">{na.label}</Link>}
              {primaryHere && editable && portalUrl && <a href={portalUrl} target="_blank" rel="noreferrer" className="btn-primary">Open official portal <ExternalLink size={15} /></a>}
              {na.assistTo && <Link to={na.assistTo} className="btn-accent"><Sparkles size={16} /> {t("help_me_fill_this")}</Link>}
            </div>
          </div>
          <div className="mt-6"><StatusSteps status={app.status} guided={!!app.form_id} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-paper-300 bg-forest-50 px-5 py-3.5 sm:px-6">
          <div className="min-w-0 flex-1 basis-64">
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-700">What's next</div>
            <div className="text-[0.95rem] text-ink-800">{na.hint}</div>
          </div>
          {(app.form_id || app.progress > 0) && (
            <div className="flex w-full max-w-xs items-center gap-3 sm:w-64"><ProgressBar value={app.progress} /><b className="text-sm">{app.progress}%</b></div>
          )}
          {app.demo && ["SUBMITTED", "UNDER_REVIEW", "FIELD_VERIFICATION"].includes(app.status) && (
            <button className="btn-secondary btn-sm" onClick={async () => { await api.post(`/api/applications/${id}/simulate-status`); load(); }}>Simulate status update (demo)</button>
          )}
        </div>
      </section>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={tabs} />
      <div className="mt-6">
        {tab === "overview" && (
          <div className={`grid gap-6 ${app.ai_notes ? "lg:grid-cols-[1fr_340px]" : "max-w-3xl"}`}>
            <div className="space-y-6">
              {!app.form_id && editable && (
                <div className="card p-5 text-[0.95rem] text-ink-700">This scheme is applied for on its official portal. Use this page to keep your documents and notes together.</div>
              )}
              {required.length > 0 && (
                <section className="card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold">Documents</h2>
                    <button className="text-sm font-semibold text-forest-700 hover:underline" onClick={() => setTab("documents")}>Manage →</button>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{readyCount} of {required.length} required documents are ready.</p>
                  <div className="mt-2"><ProgressBar value={Math.round((readyCount / required.length) * 100)} /></div>
                </section>
              )}
              <section className="card p-5">
                <h2 className="mb-4 text-lg font-bold">Timeline</h2>
                <ol className="relative ml-2 border-l-2 border-paper-300">
                  {app.timeline.map((e, i) => (
                    <li key={i} className="relative mb-5 ml-5 last:mb-0">
                      <span className={`absolute -left-7 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ring-2 ${i === app.timeline.length - 1 ? "bg-forest-600 ring-forest-200" : "bg-ink-300 ring-ink-100"}`} />
                      <div className="flex flex-wrap items-center gap-2"><StatusPill status={e.status === "CREATED" ? "DRAFT" : e.status} /><span className="text-sm text-ink-500">{formatDate(e.at, true)}</span></div>
                      {e.note && <p className="mt-1 text-sm text-ink-700">{e.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <AINotesPanel data={app.ai_notes?.data as AINotes} />
          </div>
        )}

        {tab === "answers" && app.form && (
          <div className="space-y-4">
            {app.form.sections.map((s) => {
              const done = s.fields.filter((f) => isFilled(f, app.form_data[f.id])).length;
              return (
                <section key={s.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-paper-300 bg-paper-100 px-5 py-3">
                    <h3 className="font-bold">{s.titles?.[lang] || s.title}</h3>
                    <span className={`chip ${done === s.fields.length ? "bg-leaf-50 text-leaf-700 ring-1 ring-leaf-100" : "bg-ink-100 text-ink-600"}`}>{done}/{s.fields.length} answered</span>
                  </div>
                  <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
                    {s.fields.map((f) => {
                      const ok = isFilled(f, app.form_data[f.id]);
                      const later = app.field_status[f.id] === "SKIPPED";
                      return (
                        <div key={f.id} className="flex items-start gap-2">
                          {ok ? <CheckCircle2 size={17} className="mt-0.5 flex-none text-leaf" /> : <Circle size={17} className="mt-0.5 flex-none text-ink-300" />}
                          <div className="min-w-0">
                            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{fieldLabel(f, lang, app.form_data)}</dt>
                            <dd className={`break-words text-[0.97rem] ${ok ? "text-ink-900" : "text-ink-400"}`}>{ok ? displayValue(f, app.form_data[f.id], lang, true) : later ? "Marked for later" : "Not answered yet"}</dd>
                          </div>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              );
            })}
            {editable && <div className="flex justify-end"><Link to={`/applications/${id}/form`} className="btn-secondary">Edit in the form</Link></div>}
          </div>
        )}

        {tab === "documents" && (
          required.length === 0 ? <EmptyState title="No documents listed for this scheme" /> : (
            <section className="card divide-y divide-paper-300">
              {required.map((d) => {
                const attached = app.documents.find((x) => x.requirement_code === d.code);
                const candidates = app.wallet.filter((w) => d.wallet_types.includes(w.doc_type));
                const have = d.wallet_types.some((w) => walletTypes.has(w));
                return (
                  <div key={d.code} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    {attached ? <FileCheck2 className="flex-none text-leaf" /> : have ? <FileCheck2 className="flex-none text-ink-400" /> : <FileX2 className="flex-none text-brick" />}
                    <div className="min-w-[220px] flex-1">
                      <div className="font-semibold">{d.display_name}</div>
                      <div className="text-sm text-ink-500">{attached ? `Attached: ${attached.user_document.title}` : have ? "Available in your wallet" : "Not in your document wallet yet"}</div>
                    </div>
                    {!attached && candidates.length > 0 && (
                      <select className="input w-auto py-1.5 text-sm" defaultValue="" aria-label={`Attach a document for ${d.display_name}`} onChange={(e) => e.target.value && attach(d.code, e.target.value)}>
                        <option value="">Attach from wallet…</option>
                        {candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    )}
                    {!have && <Link to="/documents" className="btn-secondary btn-sm">Upload</Link>}
                  </div>
                );
              })}
            </section>
          )
        )}

        {tab === "activity" && (
          <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <UserNotesPanel notes={notes} applicationId={id} onChange={setNotes} />
              {app.ai_notes ? <AINotesPanel data={app.ai_notes.data as AINotes} /> : <EmptyState title="No AI notes yet" />}
            </div>
            <section>
              <h2 className="mb-3 text-lg font-bold">Sources ({app.evidence.length})</h2>
              {app.evidence.length ? <EvidenceList evidence={app.evidence} /> : <EmptyState title="No sources recorded yet">Sources appear here when the assistant answers using official documents.</EmptyState>}
            </section>
            <section>
              <h2 className="mb-3 text-lg font-bold">Assistant conversation</h2>
              {app.conversation.length === 0 ? <EmptyState title="No conversation yet" /> : (
                <div className="card max-h-[32rem] space-y-4 overflow-y-auto p-5">
                  {app.conversation.map((m) => (
                    <div key={m.id} className="flex gap-3">
                      <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${m.role === "user" ? "bg-ink-100 text-ink-700" : "bg-forest-800 text-white"}`}>{m.role === "user" ? <UserIcon size={16} /> : <Bot size={16} />}</div>
                      <div className="min-w-0 flex-1 text-[0.95rem]">
                        <div className="text-xs text-ink-400">{formatDate(m.created_at, true)}</div>
                        <Markdown text={m.content.replace(/\[(chunk|fact)_[a-z0-9_]+\]/g, "")} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
