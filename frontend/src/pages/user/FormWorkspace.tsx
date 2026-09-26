import { ArrowLeft, Eye, FileCheck2, MonitorUp, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import type { FormAssistResponse, FormFieldDef, FormSchema, FormValueT, UserForm } from "@/types";
import AssistantDock, { type AssistantHandle } from "@/components/formassist/AssistantDock";
import AutoFillPanel from "@/components/formassist/AutoFillPanel";
import FormNotes from "@/components/formassist/FormNotes";
import FormPreview from "@/components/formassist/FormPreview";
import ReviewPanel from "@/components/formassist/ReviewPanel";
import Logo from "@/components/Logo";
import { ErrorNote, Modal, ProgressBar, Spinner, Tabs } from "@/components/ui";
import { DemoStrip } from "@/layouts/UserLayout";

type Tab = "autofill" | "review" | "notes";

export default function FormWorkspace() {
  const { id } = useParams();
  const { lang } = useI18n();
  const [meta, setMeta] = useState<UserForm | null>(null);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("autofill");
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<"original" | "completed">("original");
  const [showFilled, setShowFilled] = useState(true);
  const [current, setCurrent] = useState<string | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  const [reviewKey, setReviewKey] = useState("0");
  const [screenModal, setScreenModal] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const screen = useScreenCapture();
  const dock = useRef<AssistantHandle>(null);

  const loadSchema = useCallback(async () => {
    const s = await api.get<FormSchema>(`/api/forms/${id}/schema`);
    setSchema(s);
    setMeta(s.form);
    setReviewKey(String(Date.now()));
    return s;
  }, [id]);

  // Wait for analysis, then load the schema.
  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const f = await api.get<UserForm>(`/api/forms/${id}`);
        if (stop) return;
        setMeta(f);
        if (f.status === "UPLOADED") await api.post(`/api/forms/${id}/analyze`, {});
        if (f.status === "READY" || f.status === "COMPLETED") { await loadSchema(); return; }
        if (f.status === "FAILED") return;
        timer = window.setTimeout(tick, 2000);
      } catch (e: any) {
        if (!stop) setLoadError(e.message);
      }
    };
    tick();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [id, loadSchema]);

  const select = useCallback((fid: string | null, alsoTab: Tab | null = "autofill") => {
    setCurrent(fid);
    if (!fid || !schema) return;
    const f = schema.fields.find((x) => x.field_id === fid);
    if (f) setPage(f.page);
    if (alsoTab) setTab(alsoTab);
  }, [schema]);

  const onAssistantResponse = useCallback((r: FormAssistResponse) => {
    const ups = Object.keys(r.field_updates);
    if (ups.length) { setFlash(ups); window.setTimeout(() => setFlash([]), 1700); }
    loadSchema().then((s) => {
      if (r.ask) {
        setCurrent(r.ask.field_id);
        const f = s.fields.find((x) => x.field_id === r.ask!.field_id);
        if (f) setPage(f.page);
      }
    }).catch(() => undefined);
  }, [loadSchema]);

  const save = useCallback(async (values: Record<string, FormValueT | null>, extra: { skip?: string[]; rename?: Record<string, string>; use_profile?: boolean } = {}) => {
    const r = await api.post<FormSchema & { errors: Record<string, string> }>(`/api/forms/${id}/autofill`, { values, ...extra });
    const { errors, ...rest } = r as any;
    setSchema(rest as FormSchema);
    setMeta((rest as FormSchema).form);
    setReviewKey(String(Date.now()));
    return errors as Record<string, string>;
  }, [id]);

  const askAbout = (f: FormFieldDef | { field_id: string }) => {
    select(f.field_id, null);
    setDockOpen(true);
    dock.current?.ask("What does this field mean?", f.field_id);
  };

  const startScreen = async () => {
    const ok = await screen.start();
    if (ok) setScreenModal(false);
  };

  if (loadError) return <div className="p-8"><ErrorNote>{loadError}</ErrorNote><Link to="/forms" className="btn-secondary mt-4 inline-flex">Back to forms</Link></div>;
  if (meta?.status === "FAILED") {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <ErrorNote>{meta.error}</ErrorNote>
        <div className="mt-4 flex justify-center gap-2">
          <Link to="/forms" className="btn-secondary">Back to forms</Link>
          <button className="btn-primary" onClick={async () => { await api.post(`/api/forms/${id}/analyze`, { force: true }); location.reload(); }}><RefreshCw size={16} /> Try again</button>
        </div>
      </div>
    );
  }
  if (!schema || !meta) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-ink-700">
        <Spinner className="h-7 w-7" />
        <div className="font-semibold">Reading your form…</div>
        <p className="max-w-sm text-center text-sm text-ink-500">Extracting text, straightening the page and finding the fields. Scanned pages can take a little longer.</p>
      </div>
    );
  }

  const sm = schema.summary;
  const pct = sm.fillable ? Math.round((sm.completed / sm.fillable) * 100) : 0;
  const summaryLine = `${sm.detected} fields found · ${sm.completed} done · ${sm.pending} need information${sm.clarification_needed ? " · 1 question open" : ""}`;

  return (
    <div className="flex h-screen flex-col">
      <div className="tricolor-rule h-1" />
      <DemoStrip />
      <header className="flex flex-wrap items-center gap-3 border-b border-paper-300 bg-white px-4 py-2.5">
        <Link to="/forms" className="btn-ghost btn-sm"><ArrowLeft size={16} /> Forms</Link>
        <Logo sub={false} />
        <div className="ml-2 hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <span className="truncate font-semibold text-ink-800">{meta.original_filename}</span>
          <div className="w-40"><ProgressBar value={pct} /></div>
          <span className="text-sm font-bold text-ink-700">{pct}%</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1 text-xs text-ink-500 lg:flex"><ShieldCheck size={14} className="text-leaf" /> Original file is never modified</span>
          <button className="btn-secondary btn-sm" onClick={() => setScreenModal(true)} disabled={screen.active}><MonitorUp size={15} /> Start Screen Assistance</button>
          <button className="btn-accent btn-sm" onClick={() => setTab("review")}><FileCheck2 size={15} /> Generate PDF</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] lg:overflow-hidden">
          <div className="min-h-[60vh] lg:min-h-0">
            <div className="flex h-full min-h-0 flex-col gap-2">
              {meta.output_ready && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button className={`btn-sm ${source === "original" ? "btn-primary" : "btn-secondary"}`} onClick={() => setSource("original")}>Original</button>
                  <button className={`btn-sm ${source === "completed" ? "btn-primary" : "btn-secondary"}`} onClick={() => { setSource("completed"); }}><Eye size={14} /> Completed PDF</button>
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-600"><input type="checkbox" checked={showFilled} onChange={(e) => setShowFilled(e.target.checked)} /> Highlight filled fields</label>
                </div>
              )}
              <div className="min-h-0 flex-1">
                <FormPreview formId={meta.id} schema={schema} page={page} onPage={setPage} source={source} version={meta.output_at ?? "0"}
                  currentFieldId={current} onSelectField={(fid) => select(fid)} showFilled={showFilled} flashIds={flash} />
              </div>
            </div>
          </div>
          <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border border-paper-300 bg-paper-100 lg:min-h-0" aria-label="AutoFill, review and notes">
            <Tabs<Tab> value={tab} onChange={setTab} tabs={[
              { id: "autofill", label: "AutoFill" },
              { id: "review", label: `Review${sm.required_missing ? ` (${sm.required_missing})` : ""}` },
              { id: "notes", label: "Notes" },
            ]} />
            <div className="min-h-0 flex-1">
              {tab === "autofill" && <AutoFillPanel schema={schema} currentFieldId={current} flashIds={flash} onSelect={(fid) => select(fid, null)} onSave={save} onAsk={askAbout} />}
              {tab === "review" && (
                <ReviewPanel form={meta} refreshKey={reviewKey}
                  onEdit={(fid) => { select(fid, "autofill"); }}
                  onAsk={(fid) => askAbout({ field_id: fid })}
                  onGenerated={(f) => { setMeta(f); setSource("completed"); loadSchema().catch(() => undefined); }}
                  onPreviewPdf={() => setSource("completed")}
                  onEditInfo={() => { setSource("original"); setTab("autofill"); }} />
              )}
              {tab === "notes" && <FormNotes formId={meta.id} aiNotes={schema.ai_notes} />}
            </div>
          </section>
        </div>
        {dockOpen ? (
          <AssistantDock ref={dock} formId={meta.id} lang={lang} currentFieldId={current} screen={screen} onStartScreen={() => setScreenModal(true)}
            onResponse={onAssistantResponse} onEnd={() => setDockOpen(false)} summaryLine={summaryLine} />
        ) : (
          <div className="flex items-center justify-between border-t border-paper-300 bg-white px-4 py-2 text-sm">
            <span className="text-ink-600">Assistant ended. {summaryLine}</span>
            <button className="btn-primary btn-sm" onClick={() => setDockOpen(true)}>Talk to the assistant</button>
          </div>
        )}
      </div>

      <Modal open={screenModal} onClose={() => setScreenModal(false)} title="Start AI Screen Assistance">
        <p className="text-ink-700">If you like, I can look at your screen while you fill in a form somewhere else, and help with what I see. Your browser will ask what to share — a tab, a window or your whole screen.</p>
        <ul className="mt-4 space-y-2 text-sm text-ink-700">
          <li className="flex gap-2"><ShieldCheck size={17} className="flex-none text-leaf" /> Only you decide what is shared, and you can stop at any time with <b>Stop Assistance</b>.</li>
          <li className="flex gap-2"><ShieldCheck size={17} className="flex-none text-leaf" /> A single frame is used only when you ask me a question. Nothing is recorded or stored.</li>
          <li className="flex gap-2"><ShieldCheck size={17} className="flex-none text-leaf" /> Please don't show passwords, OTPs or PINs. I never need them.</li>
        </ul>
        {screen.error && <p className="mt-3 text-sm text-brick">{screen.error} You can keep using the assistant without sharing your screen.</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setScreenModal(false)}>Not now</button>
          <button className="btn-accent" onClick={startScreen}><MonitorUp size={17} /> Choose what to share</button>
        </div>
      </Modal>
    </div>
  );
}
