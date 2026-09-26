import { CheckCircle2, Circle, ExternalLink, FileCheck2, FileX2, MonitorSmartphone, Play, Bot, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import type { AINotes, ApplicationDetail as AD, Note } from "@/types";
import { AINotesPanel, UserNotesPanel } from "@/components/Notes";
import { EvidenceList } from "@/components/Evidence";
import Markdown from "@/components/Markdown";
import { EmptyState, PageHeader, ProgressBar, Spinner, StatusPill, Tabs, formatDate } from "@/components/ui";
import { displayValue, fieldLabel, isFilled } from "@/components/formUtils";

type Tab = "overview" | "documents" | "progress" | "ai" | "notes" | "evidence" | "conversation";

export default function ApplicationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lang, t } = useI18n();
  const [app, setApp] = useState<AD | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [notes, setNotes] = useState<Note[]>([]);

  const load = () =>
    api.get<AD>(`/api/applications/${id}`).then((a) => {
      setApp(a);
      setNotes(a.user_notes);
    });
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!app) return <Spinner className="h-6 w-6" />;
  const editable = ["IN_PROGRESS", "DRAFT", "DOCUMENTS_REQUIRED"].includes(app.status);
  const attachedCodes = new Set(app.documents.map((d) => d.requirement_code));
  const walletTypes = new Set(app.wallet.map((w) => w.doc_type));

  const attach = async (reqCode: string, docId: string) => {
    await api.post(`/api/applications/${id}/documents`, { user_document_id: docId, requirement_code: reqCode });
    load();
  };

  return (
    <div>
      <Link to="/applications" className="text-sm font-semibold text-ink-600">← {t("applications")}</Link>
      <PageHeader
        eyebrow={app.reference_number ? `Reference ${app.reference_number}` : "Application"}
        title={app.scheme_name}
        subtitle={<span className="inline-flex items-center gap-3"><StatusPill status={app.status} /> <span>Started {formatDate(app.created_at)}</span></span>}
        actions={
          <>
            {editable && app.form_id && (
              <>
                <button className="btn-secondary" onClick={() => nav(`/applications/${id}/form`)}><Play size={16} /> Open form</button>
                <button className="btn-accent" onClick={() => nav(`/applications/${id}/form?assist=1`)}><MonitorSmartphone size={16} /> {t("help_me_fill_this")}</button>
              </>
            )}
            {app.demo && ["SUBMITTED", "UNDER_REVIEW", "FIELD_VERIFICATION"].includes(app.status) && (
              <button className="btn-secondary" onClick={async () => { await api.post(`/api/applications/${id}/simulate-status`); load(); }}>Simulate status update (demo)</button>
            )}
          </>
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "documents", label: t("documents") },
          { id: "progress", label: t("form_progress") },
          { id: "ai", label: t("ai_notes") },
          { id: "notes", label: t("my_notes") },
          { id: "evidence", label: `Evidence (${app.evidence.length})` },
          { id: "conversation", label: "Conversation" },
        ]}
      />
      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="card p-5">
              <h2 className="mb-1 text-lg font-bold">Progress</h2>
              <div className="flex items-center gap-3"><ProgressBar value={app.progress} /><b>{app.progress}%</b></div>
              {editable && app.form_id && (
                <p className="mt-3 rounded-lg bg-paper-100 px-3 py-2 text-ink-700">
                  {app.last_completed_section ? <>Last completed: <b>{app.last_completed_section}</b>. </> : null}
                  {app.next_section ? <>Next: <b>{app.next_section}</b>.</> : null}
                </p>
              )}
              {!app.form_id && editable && (
                <p className="mt-3 rounded-lg bg-paper-100 px-3 py-2 text-sm text-ink-700">
                  This scheme is applied for on its official portal. Use this tracker to keep documents and notes together.
                  {app.scheme?.portal?.url && <a className="ml-1 inline-flex items-center gap-1 font-semibold underline decoration-saffron" href={app.scheme.portal.url} target="_blank" rel="noreferrer">Open portal <ExternalLink size={12} /></a>}
                </p>
              )}
              <h2 className="mb-3 mt-6 text-lg font-bold">Timeline</h2>
              <ol className="relative ml-2 border-l-2 border-paper-300">
                {app.timeline.map((e, i) => (
                  <li key={i} className="mb-4 ml-5">
                    <span className={`absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-white ${i === app.timeline.length - 1 ? "bg-saffron" : "bg-ink-300"}`} />
                    <div className="flex items-center gap-2"><StatusPill status={e.status === "CREATED" ? "DRAFT" : e.status} /><span className="text-sm text-ink-500">{formatDate(e.at, true)}</span></div>
                    {e.note && <p className="mt-1 text-sm text-ink-700">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
            <AINotesPanel data={app.ai_notes?.data as AINotes} />
          </div>
        )}

        {tab === "documents" && (
          <section className="card divide-y divide-paper-300">
            {(app.scheme?.documents ?? []).map((d) => {
              const attached = app.documents.find((x) => x.requirement_code === d.code);
              const candidates = app.wallet.filter((w) => d.wallet_types.includes(w.doc_type));
              const have = d.wallet_types.some((w) => walletTypes.has(w));
              return (
                <div key={d.code} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  {attached || attachedCodes.has(d.code) ? <FileCheck2 className="text-leaf" /> : have ? <FileCheck2 className="text-ink-400" /> : <FileX2 className="text-brick" />}
                  <div className="min-w-[220px] flex-1">
                    <div className="font-semibold">{d.display_name}</div>
                    <div className="text-sm text-ink-500">{attached ? `Attached: ${attached.user_document.title}` : have ? "Available in your wallet" : "Not in your document wallet yet"}</div>
                  </div>
                  {!attached && candidates.length > 0 && (
                    <select className="input w-auto py-1.5 text-sm" defaultValue="" onChange={(e) => e.target.value && attach(d.code, e.target.value)}>
                      <option value="">Attach from wallet…</option>
                      {candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  )}
                  {!have && <Link to="/documents" className="btn-secondary btn-sm">Upload</Link>}
                </div>
              );
            })}
          </section>
        )}

        {tab === "progress" && (app.form ? (
          <div className="space-y-4">
            {app.form.sections.map((s) => (
              <section key={s.id} className="card p-5">
                <h3 className="mb-3 font-bold">{s.titles?.[lang] || s.title}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {s.fields.map((f) => {
                    const ok = isFilled(f, app.form_data[f.id]);
                    const st = app.field_status[f.id];
                    return (
                      <li key={f.id} className="flex items-start gap-2">
                        {ok ? <CheckCircle2 size={17} className="mt-0.5 text-leaf" /> : <Circle size={17} className="mt-0.5 text-ink-300" />}
                        <div>
                          <div className="text-sm font-semibold">{fieldLabel(f, lang, app.form_data)} <span className="ml-1 text-xs font-bold text-ink-400">{ok ? "COMPLETE" : st === "SKIPPED" ? "LATER" : "PENDING"}</span></div>
                          {ok && <div className="text-sm text-ink-600">{displayValue(f, app.form_data[f.id], lang, true)}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : <EmptyState title="No online form for this scheme">Apply through the official portal.</EmptyState>)}

        {tab === "ai" && (app.ai_notes ? <div className="max-w-xl"><AINotesPanel data={app.ai_notes.data as AINotes} /></div> : <EmptyState title="No AI notes yet" />)}
        {tab === "notes" && <div className="max-w-xl"><UserNotesPanel notes={notes} applicationId={id} onChange={setNotes} /></div>}
        {tab === "evidence" && (app.evidence.length ? <EvidenceList evidence={app.evidence} /> : <EmptyState title="No evidence recorded yet">Evidence appears here when the assistant answers with official sources.</EmptyState>)}
        {tab === "conversation" && (
          app.conversation.length === 0 ? <EmptyState title="No conversation yet" /> : (
            <div className="card space-y-3 p-5">
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
          )
        )}
      </div>
    </div>
  );
}
