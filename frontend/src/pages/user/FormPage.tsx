import { ArrowLeft, CheckCircle2, Circle, CircleDashed, MonitorSmartphone, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import type { AINotes, ApplicationDetail, AssistResponse, Lang, Note } from "@/types";
import MockGovForm from "@/components/MockGovForm";
import AssistPanel from "@/components/AssistPanel";
import { AINotesPanel, UserNotesPanel } from "@/components/Notes";
import Logo from "@/components/Logo";
import { Modal, ProgressBar, Spinner } from "@/components/ui";
import { allFields, fieldLabel, isFilled } from "@/components/formUtils";

export default function FormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { lang, setLang, t } = useI18n();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [aiNotes, setAiNotes] = useState<AINotes | null>(null);
  const [notesFlash, setNotesFlash] = useState(false);
  const [userNotes, setUserNotes] = useState<Note[]>([]);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<string[]>([]);
  const [startOpen, setStartOpen] = useState(params.get("assist") === "1");
  const [session, setSession] = useState<{ id: string; initial: AssistResponse } | null>(null);
  const [assistLang, setAssistLang] = useState<Lang>(lang);
  const [starting, setStarting] = useState(false);
  const [saved, setSaved] = useState<string>("");
  const formRef = useRef<HTMLDivElement>(null);
  const focused = useRef<string | null>(null);
  const saveTimer = useRef<number>();
  const screen = useScreenCapture();

  const load = useCallback(async () => {
    const a = await api.get<ApplicationDetail>(`/api/applications/${id}`);
    if (!a.form) return nav(`/applications/${id}`, { replace: true });
    if (!["IN_PROGRESS", "DRAFT", "DOCUMENTS_REQUIRED"].includes(a.status)) return nav(`/applications/${id}`, { replace: true });
    setApp(a);
    setValues(a.form_data);
    setStatus(a.field_status);
    setProgress(a.progress);
    setAiNotes((a.ai_notes?.data as AINotes) ?? null);
    setUserNotes(a.user_notes);
  }, [id, nav]);

  useEffect(() => {
    load();
  }, [load]);

  const scrollTo = (fid: string) => {
    const el = formRef.current?.querySelector(`[data-field-id="${fid}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* Structured reading of what is visible on screen (labels, required markers, buttons, warnings). */
  const collectScreen = useCallback(() => {
    const root = formRef.current;
    const vh = window.innerHeight;
    const visible = Array.from(root?.querySelectorAll<HTMLElement>("[data-field-id]") ?? [])
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < vh;
      })
      .map((el) => ({ id: el.dataset.fieldId!, label: el.dataset.label!, required: el.dataset.required === "1", filled: el.dataset.filled === "1" }));
    const buttons = Array.from(root?.querySelectorAll("button") ?? []).map((b) => b.textContent?.trim() ?? "").filter(Boolean);
    const warnings = Array.from(root?.querySelectorAll("[data-warning]") ?? []).map((w) => w.textContent?.trim() ?? "");
    return { visible_fields: visible, focused_field_id: focused.current, buttons, warnings, values };
  }, [values]);

  const onChange = (fid: string, v: any) => {
    const next = { ...values, [fid]: v };
    setValues(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const r = await api.patch<{ form_data: any; field_status: any; progress: number }>(`/api/applications/${id}/form`, { values: { [fid]: v } });
      setStatus(r.field_status);
      setProgress(r.progress);
      setSaved(new Date().toLocaleTimeString("en-IN", { timeStyle: "short" }));
      const a = await api.get<ApplicationDetail>(`/api/applications/${id}`);
      setAiNotes((a.ai_notes?.data as AINotes) ?? null);
    }, 600);
  };

  const onResponse = (r: AssistResponse) => {
    const ups = Object.keys(r.field_updates);
    if (ups.length) {
      setValues((v) => ({ ...v, ...r.field_updates }));
      setFlashIds(ups);
      setTimeout(() => setFlashIds([]), 1700);
    }
    setStatus(r.field_status);
    setProgress(r.progress);
    setAiNotes(r.ai_notes);
    setNotesFlash(true);
    setTimeout(() => setNotesFlash(false), 1700);
    if (r.current_field) {
      setHighlight(r.current_field.id);
      setTimeout(() => scrollTo(r.current_field!.id), ups.length ? 500 : 50);
    } else setHighlight(null);
  };

  const startAssist = async (withScreen: boolean) => {
    setStarting(true);
    if (withScreen) await screen.start();
    try {
      await new Promise((r) => setTimeout(r, 400)); // let the first frame arrive
      const ctx = collectScreen();
      const r = await api.post<AssistResponse>("/api/screen-assistance/sessions", {
        application_id: id, language: assistLang, screen_shared: withScreen, screen: { ...ctx, frame: screen.grabFrame() },
      });
      setSession({ id: r.session_id, initial: r });
      onResponse(r);
      setStartOpen(false);
    } finally {
      setStarting(false);
    }
  };

  const addNote = async (content: string, item_type: "todo" | "question") => {
    const n = await api.post<Note>("/api/notes", { content, item_type, application_id: id, origin: "ai_suggested" });
    setUserNotes((u) => [...u, n]);
  };

  if (!app || !app.form) return <div className="p-10"><Spinner className="h-6 w-6" /></div>;
  const form = app.form;
  const fields = allFields(form);

  return (
    <div className="flex h-screen flex-col">
      <div className="tricolor-rule h-1" />
      <header className="flex items-center gap-2 border-b border-paper-300 bg-white px-3 py-2.5 sm:gap-4 sm:px-5">
        <Link to={`/applications/${id}`} className="btn-ghost btn-sm"><ArrowLeft size={16} /> Back</Link>
        <div className="hidden sm:block"><Logo sub={false} /></div>
        <div className="ml-4 hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <span className="truncate font-semibold text-ink-800">{app.scheme_name}</span>
          <div className="w-48"><ProgressBar value={progress} /></div>
          <span className="text-sm font-bold text-ink-700">{progress}%</span>
          {saved && <span className="text-xs text-ink-400">Saved {saved}</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {progress >= 100 && <button className="btn-accent btn-sm whitespace-nowrap" onClick={() => nav(`/applications/${id}/review`)}><CheckCircle2 size={16} /> {t("review")}</button>}
          {!session && <button className="btn-primary btn-sm whitespace-nowrap" onClick={() => setStartOpen(true)}><Sparkles size={16} /> {t("help_me_fill_this")}</button>}
        </div>
      </header>
      {/* The header's progress bar is hidden on phones, so show a slim one here instead. */}
      <div className="flex items-center gap-3 border-b border-paper-300 bg-white px-4 py-2 md:hidden">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">{app.scheme_name}</span>
        <div className="w-24"><ProgressBar value={progress} /></div>
        <span className="text-sm font-bold text-ink-700">{progress}%</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_410px]">
        <aside className="hidden min-h-0 space-y-4 overflow-y-auto pb-6 lg:block">
          <section className="card p-4">
            <h3 className="mb-2 font-semibold uppercase tracking-wide text-ink-800">{t("form_progress")}</h3>
            <ProgressBar value={progress} />
            <ul className="mt-3 space-y-0.5 text-[0.88rem]">
              {fields.map((f) => {
                const st = isFilled(f, values[f.id]) ? "COMPLETE" : status[f.id] ?? "PENDING";
                return (
                  <li key={f.id}>
                    <button onClick={() => { setHighlight(f.id); scrollTo(f.id); }} className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-paper-100 ${highlight === f.id ? "bg-saffron-50 font-semibold" : ""}`}>
                      {st === "COMPLETE" ? <CheckCircle2 size={15} className="flex-none text-leaf" /> : st === "SKIPPED" ? <CircleDashed size={15} className="flex-none text-saffron" /> : <Circle size={15} className="flex-none text-ink-300" />}
                      <span className="flex-1 truncate">{fieldLabel(f, lang, values)}</span>
                      <span className={`text-[0.65rem] font-bold ${st === "COMPLETE" ? "text-leaf" : st === "SKIPPED" ? "text-saffron-600" : "text-ink-400"}`}>{st === "COMPLETE" ? "DONE" : st === "SKIPPED" ? "LATER" : "PENDING"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <UserNotesPanel notes={userNotes} applicationId={id} onChange={setUserNotes} />
          <AINotesPanel data={aiNotes} flash={notesFlash} />
        </aside>

        <main className="min-h-0 overflow-y-auto pb-10">
          <MockGovForm ref={formRef} form={form} values={values} lang={lang} highlightId={highlight} flashIds={flashIds}
            onChange={onChange} onFocusField={(fid) => (focused.current = fid)}
            onSave={() => setSaved(new Date().toLocaleTimeString("en-IN", { timeStyle: "short" }))}
            onReview={() => nav(`/applications/${id}/review`)} />
        </main>

        <aside className={session ? "fixed bottom-3 right-3 top-28 z-40 w-[400px] xl:static xl:z-auto xl:w-auto xl:min-h-0" : "hidden min-h-0 xl:block"}>
          {session ? (
            <AssistPanel applicationId={id!} sessionId={session.id} initial={session.initial} lang={assistLang}
              setLang={(l) => { setAssistLang(l); setLang(l); }} screen={screen} collectScreen={collectScreen}
              onResponse={onResponse} onAddNote={addNote} onEnd={() => { setSession(null); setHighlight(null); load(); }} />
          ) : (
            <div className="card flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-saffron-50 text-saffron-700"><MonitorSmartphone size={32} /></div>
              <h2 className="font-display text-2xl font-bold">Need help with this form?</h2>
              <p className="mt-2 text-ink-600">The assistant can look at the form on your screen, explain each field in your language and fill in what you tell it.</p>
              <button className="btn-accent mt-6 px-6 py-3 text-base" onClick={() => setStartOpen(true)}><Sparkles size={18} /> {t("help_me_fill_this")}</button>
              {app.progress > 0 && <p className="mt-3 text-sm text-ink-500">You're {app.progress}% done{app.last_completed_section ? ` · last completed: ${app.last_completed_section}` : ""}.</p>}
            </div>
          )}
        </aside>
      </div>

      <Modal open={startOpen} onClose={() => setStartOpen(false)} title="Start assistance session">
        <p className="text-ink-700">The AI will use your current screen to help explain and complete the form. You choose what to share, and you can stop at any time.</p>
        <ul className="mt-4 space-y-2 text-sm text-ink-700">
          <li className="flex gap-2"><ShieldCheck size={17} className="flex-none text-leaf" /> Screen frames are used only to answer your questions — nothing is recorded or stored.</li>
          <li className="flex gap-2"><ShieldCheck size={17} className="flex-none text-leaf" /> Explanations come from official sources, with evidence you can open.</li>
          <li className="flex gap-2"><ShieldCheck size={17} className="flex-none text-leaf" /> Nothing is submitted without your explicit confirmation.</li>
        </ul>
        <div className="mt-5">
          <span className="label">Assistant language</span>
          <div className="grid grid-cols-3 gap-2">
            {(["en", "hi", "kn"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setAssistLang(l)} className={`rounded-lg border px-3 py-2 font-semibold ${assistLang === l ? "border-ink-800 bg-forest-800 text-white" : "border-ink-200 bg-white"}`}>
                {{ en: "English", hi: "हिन्दी", kn: "ಕನ್ನಡ" }[l]}
              </button>
            ))}
          </div>
        </div>
        {screen.error && <p className="mt-3 text-sm text-brick">{screen.error} You can continue without screen sharing.</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-ghost" disabled={starting} onClick={() => startAssist(false)}>Continue without screen sharing</button>
          <button className="btn-accent" disabled={starting} onClick={() => startAssist(true)}>{starting ? <Spinner /> : <MonitorSmartphone size={17} />} Start Screen Assistance</button>
        </div>
        <p className="mt-3 text-xs text-ink-500">Tip: in the browser's share dialog, choose <b>This tab</b>. Voice works best in Chrome or Edge.</p>
      </Modal>
    </div>
  );
}
