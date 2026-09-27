import { ArrowLeft, Bot, Eye, FileCheck2, FileText, ListChecks, MonitorUp, RefreshCw, Share2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import type { FormAssistResponse, FormFieldDef, FormSchema, FormValueT, UserForm } from "@/types";
import AssistantDock, { type AssistantHandle } from "@/components/formassist/AssistantDock";
import ShareSheet from "@/components/formassist/ShareSheet";
import AutoFillPanel from "@/components/formassist/AutoFillPanel";
import FormNotes from "@/components/formassist/FormNotes";
import FormPreview from "@/components/formassist/FormPreview";
import ReviewPanel from "@/components/formassist/ReviewPanel";
import Logo from "@/components/Logo";
import Splitter from "@/components/Splitter";
import { useColumns } from "@/hooks/useSplit";
import { ErrorNote, Modal, ProgressBar, Spinner, Tabs } from "@/components/ui";

type Tab = "autofill" | "review" | "notes";
// Phones show one pane at a time; from `lg` up all three are visible and resizable.
type Pane = "form" | "assistant" | "fields";

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
  // A field the citizen clicked since the assistant's last reply. Only then does a message target that field
  // explicitly; otherwise the server's own pointer decides (it owns the form state).
  const [picked, setPicked] = useState<string | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  const [reviewKey, setReviewKey] = useState("0");
  const [screenModal, setScreenModal] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const screen = useScreenCapture();
  const dock = useRef<AssistantHandle>(null);
  const [pane, setPane] = useState<Pane>("assistant");
  const [unread, setUnread] = useState(false);
  const paneRef = useRef(pane);
  paneRef.current = pane;
  // Widths of the left (fields) and right (assistant) panels; the form in the middle takes the rest. Remembered per browser.
  const cols = useColumns({ storageKey: "sahayak.split.columns", leftDefault: 0.27, rightDefault: 0.3, leftMin: 280, rightMin: 320, centerMin: 360 });

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
    setPicked(fid);
    if (!fid || !schema) return;
    const f = schema.fields.find((x) => x.field_id === fid);
    if (f) setPage(f.page);
    if (alsoTab) setTab(alsoTab);
  }, [schema]);

  const onAssistantResponse = useCallback((r: FormAssistResponse) => {
    const ups = Object.keys(r.field_updates);
    if (ups.length) { setFlash(ups); window.setTimeout(() => setFlash([]), 1700); }
    setPicked(null);
    if (paneRef.current !== "assistant") setUnread(true);
    // Show the field being asked right away; waiting for the schema reload let the next message go to the old field.
    if (r.ask) setCurrent(r.ask.field_id);
    loadSchema().then((s) => {
      if (r.ask) {
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
    setPane("assistant");
    setUnread(false);
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
        <div className="font-medium">Reading your form…</div>
        <p className="max-w-sm text-center text-sm text-ink-500">Extracting text, straightening the page and finding the fields. Scanned pages can take a little longer.</p>
      </div>
    );
  }

  const sm = schema.summary;
  const pct = sm.fillable ? Math.round((sm.completed / sm.fillable) * 100) : 0;
  const summaryLine = `${sm.detected} fields found · ${sm.completed} done · ${sm.pending} need information${sm.clarification_needed ? " · 1 question open" : ""}`;

  return (
    <div className="flex h-screen h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-paper-300 bg-white px-4 py-2.5">
        <Link to="/forms" className="btn-ghost btn-sm"><ArrowLeft size={16} /> Forms</Link>
        <Logo sub={false} />
        <div className="ml-2 hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <span className="truncate font-medium text-ink-800">{meta.original_filename}</span>
          <div className="w-40"><ProgressBar value={pct} /></div>
          <span className="text-sm font-medium text-ink-700">{pct}%</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1 text-xs text-ink-500 lg:flex"><ShieldCheck size={14} className="text-leaf" /> Original file is never modified</span>
          <button className="btn-secondary btn-sm" onClick={() => setShareOpen(true)}><Share2 size={15} /> Share</button>
          <button className="btn-accent btn-sm" onClick={() => { setTab("review"); setPane("fields"); }}><FileCheck2 size={15} /> Generate PDF</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Phones: one pane at a time, so the assistant gets the whole screen. */}
        <div className="grid flex-none grid-cols-3 gap-1 border-b border-paper-300 bg-white p-1.5 lg:hidden" role="tablist" aria-label="Workspace view">
          {([["fields", "Fields", ListChecks], ["form", "Form", FileText], ["assistant", "Assistant", Bot]] as const).map(([id, label, Icon]) => (
            <button key={id} role="tab" aria-selected={pane === id} onClick={() => { setPane(id); if (id === "assistant") setUnread(false); }}
              className={`relative flex min-h-[40px] items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors ${pane === id ? "bg-forest-100 text-forest-800" : "text-ink-600 hover:bg-ink-100"}`}>
              <Icon size={16} /> {label}
              {id === "assistant" && unread && pane !== "assistant" && <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-amber" role="status" aria-label="New reply" />}
            </button>
          ))}
        </div>
        <div ref={cols.containerRef} className="flex min-h-0 flex-1 flex-col p-3 lg:flex-row">
          {/* Left: AutoFill, review and notes */}
          <section style={{ "--w": `${cols.leftWidth}px` } as CSSProperties} aria-label="AutoFill, review and notes"
            className={`${pane === "fields" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-paper-300 bg-paper-100 lg:flex lg:w-[var(--w)] lg:flex-none`}>
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
                  onPreviewPdf={() => { setSource("completed"); setPane("form"); }}
                  onEditInfo={() => { setSource("original"); setTab("autofill"); }} />
              )}
              {tab === "notes" && <FormNotes formId={meta.id} aiNotes={schema.ai_notes} />}
            </div>
          </section>
          <Splitter split={cols.left} label="Resize the fields panel" className="hidden lg:flex" />

          {/* Centre: the form */}
          <div className={`${pane === "form" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col lg:flex`}>
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

          <Splitter split={cols.right} label="Resize the assistant panel" className="hidden lg:flex" />
          {/* Right: the AI assistant */}
          <section aria-label="AI assistant" style={{ "--w": `${cols.rightWidth}px` } as CSSProperties}
            className={`${pane === "assistant" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-paper-300 bg-white lg:flex lg:w-[var(--w)] lg:flex-none`}>
            {dockOpen ? (
              <AssistantDock ref={dock} formId={meta.id} lang={lang} pickedFieldId={picked} screen={screen} onStartScreen={() => setScreenModal(true)}
                onResponse={onAssistantResponse} onEnd={() => setDockOpen(false)} summaryLine={summaryLine} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <Bot size={28} className="text-forest-700" aria-hidden />
                <p className="text-sm text-ink-600">Assistant ended.<br />{summaryLine}</p>
                <button className="btn-primary btn-sm" onClick={() => setDockOpen(true)}>Talk to the assistant</button>
              </div>
            )}
          </section>
        </div>
      </div>

      <ShareSheet
        open={shareOpen} onClose={() => setShareOpen(false)}
        formId={meta.id} formName={meta.original_filename}
        outputReady={!!meta.output_ready}
        fields={schema.fields} values={schema.values}
        getTranscript={() => dock.current?.getTranscript() ?? ""}
      />

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
