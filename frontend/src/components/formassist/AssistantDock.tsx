import { Bot, MonitorOff, MonitorUp, PhoneOff } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { api } from "@/services/api";
import type { Evidence, FormAssistResponse, FormAssistSection, Lang } from "@/types";
import Markdown, { citationOrderFrom } from "@/components/Markdown";
import { EvidenceDrawer, SourcesButton } from "@/components/Evidence";
import ChatInput, { type InputMode } from "@/components/ChatInput";
import { Spinner } from "@/components/ui";
import { QuoteButton, ReferenceChip, type ReferenceState } from "@/components/Reference";

interface Msg { id: string; role: "user" | "assistant" | "system"; sections: FormAssistSection[]; choices?: string[] | null }
interface Screen { active: boolean; error: string | null; stop: () => void; grabFrame: () => string | null; videoRef: React.MutableRefObject<HTMLVideoElement | null> }
export interface AssistantHandle { ask: (text: string, fieldId?: string) => void }
interface Props {
  formId: string;
  lang: Lang;
  /** A field the citizen clicked since the last reply (explicit target), else null. */
  pickedFieldId: string | null;
  screen: Screen;
  onStartScreen: () => void;
  onResponse: (r: FormAssistResponse) => void;
  onEnd: () => void;
  summaryLine: string;
}

// Screen frames are only sent with questions (never continuously). Keep in sync with QUESTION_RE in backend assistant.py.
const QUESTION_RE = /\?|^\s*(what|where|which|how|why|who|when|do|does|is|are|can|could|should|explain|tell me)\b|क्या|कहाँ|कैसे|क्यों|ಏನು|ಎಲ್ಲಿ|ಹೇಗೆ|ಯಾಕೆ/i;
const TAG: Record<FormAssistSection["kind"], { label: string; cls: string } | null> = {
  knowledge: { label: "KNOWLEDGE BASE INFORMATION", cls: "bg-saffron-50 text-saffron-700 ring-1 ring-saffron-100" },
  assistant: null,
};

const AssistantDock = forwardRef<AssistantHandle, Props>(function AssistantDock({ formId, lang, pickedFieldId, screen, onStartScreen, onResponse, onEnd, summaryLine }, ref) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<{ evidence: Evidence[]; focus?: string | null } | null>(null);
  const [reference, setReference] = useState<ReferenceState | null>(null);
  const referenceRef = useRef<ReferenceState | null>(null);
  referenceRef.current = reference;
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const fieldRef = useRef(pickedFieldId);
  fieldRef.current = pickedFieldId;
  // The field the server last asked. Updated as soon as a reply arrives and echoed back, so the server can refuse
  // an answer meant for a question it has already moved past.
  const pendingRef = useRef<string | null>(null);

  const send = useCallback(async (text: string, fieldId?: string, silent = false, mode: InputMode = "text") => {
    const msg = text.trim();
    if (busy || (!msg && !silent)) return;
    if (msg) setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", sections: [{ kind: "assistant", text: msg }] }]);
    setBusy(true);
    const ref = referenceRef.current;
    setReference(null);
    try {
      const frame = screen.active && msg && QUESTION_RE.test(msg) ? screen.grabFrame() : null;
      const r = await api.post<FormAssistResponse>(`/api/forms/${formId}/assistant`, {
        message: msg, current_field_id: fieldId ?? fieldRef.current, pending_field_id: pendingRef.current, language: lang, frame,
        screen_shared: screen.active, input_mode: mode,
        ...(ref ? { reference_message_id: ref.id, reference_text: ref.text.slice(0, 1200) } : {}),
      });
      pendingRef.current = r.pending_field_id ?? null;
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", sections: r.sections, choices: r.choices }]);
      onResponse(r);
    } catch (e: any) {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "system", sections: [{ kind: "assistant", text: e.message }] }]);
    } finally {
      setBusy(false);
    }
  }, [busy, formId, lang, onResponse, screen]);

  useImperativeHandle(ref, () => ({ ask: (t, fid) => send(t, fid) }), [send]);

  useEffect(() => { // greet (or restore the conversation) once
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const h = await api.get<{ history: { role: string; text: string }[]; active: boolean }>(`/api/forms/${formId}/assistant`);
        if (h.active && h.history.length) {
          setMessages(h.history.map((x, i) => ({ id: `h-${i}`, role: x.role === "user" ? "user" : "assistant", sections: [{ kind: "assistant", text: x.text }] })));
          return;
        }
      } catch { /* fall through to greeting */ }
      send("", undefined, true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const end = async () => {
    screen.stop();
    await api.post(`/api/forms/${formId}/assistant/end`).catch(() => undefined);
    onEnd();
  };

  const lastId = messages[messages.length - 1]?.id;
  return (
    <div className="flex max-h-[36vh] min-h-[200px] flex-col border-t border-paper-300 bg-white lg:max-h-[30vh]">
      <div className="flex flex-wrap items-center gap-2 border-b border-paper-300 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800"><Bot size={17} /> AI Assistant</div>
        <span className="hidden truncate text-xs text-ink-500 md:inline">{summaryLine}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {screen.active ? (
            <>
              <span role="status" className="flex items-center gap-1.5 rounded-md bg-leaf px-2.5 py-1 text-xs font-semibold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> 🟢 Screen assistance active</span>
              <button className="flex items-center gap-1.5 rounded-md bg-brick px-2.5 py-1 text-xs font-semibold text-white" onClick={screen.stop}><MonitorOff size={14} /> Stop Assistance</button>
            </>
          ) : (
            <button className="btn-secondary btn-sm" onClick={onStartScreen}><MonitorUp size={15} /> Start AI Screen Assistance</button>
          )}
          <button className="btn-danger btn-sm" onClick={end}><PhoneOff size={14} /> End</button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3" aria-live="polite">
          {messages.map((m) => {
            if (m.role === "user") return <div key={m.id} className="ml-10 rounded-2xl rounded-tr-sm bg-ink-100 px-3.5 py-2 text-[0.95rem]">{m.sections[0].text}</div>;
            if (m.role === "system") return <div key={m.id} className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick">{m.sections[0].text}</div>;
            return (
              <div key={m.id} className="mr-6 space-y-1.5">
                {m.sections.map((s, i) => {
                  const tag = TAG[s.kind];
                  const ev = s.evidence ?? [];
                  const order = citationOrderFrom(s.text, ev.map((e) => e.id));
                  const ordered = order.map((id) => ev.find((e) => e.id === id)!).filter(Boolean);
                  return (
                    <div key={i} className={`rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-[0.95rem] ${tag ? "border-paper-300 bg-paper-100" : "border-paper-300 bg-white"}`}>
                      {tag && <span className={`chip mb-1.5 ${tag.cls}`}>{tag.label}</span>}
                      <Markdown text={s.text} citationOrder={order} onCite={(id) => setDrawer({ evidence: ordered, focus: id })} />
                      {ordered.length > 0 && <SourcesButton evidence={ordered} onOpen={() => setDrawer({ evidence: ordered })} />}
                    </div>
                  );
                })}
                <QuoteButton messageId={m.id} text={m.sections.map((s) => s.text).join(" ")} onSet={setReference} />
                {m.id === lastId && m.choices && m.choices.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-0.5">{m.choices.map((c) => <button key={c} disabled={busy} className="btn-secondary btn-sm" onClick={() => send(c)}>{c}</button>)}</div>
                )}
              </div>
            );
          })}
          {busy && <div className="flex items-center gap-2 text-sm text-ink-500"><Spinner /> {screen.active ? "Looking at your screen and the form…" : "Thinking…"}</div>}
          <div ref={bottom} />
        </div>
        {screen.active && (
          <div className="hidden w-44 flex-none border-l border-paper-300 p-2 md:block">
            <video ref={screen.videoRef} muted playsInline aria-label="Preview of the screen you are sharing" className="aspect-video w-full rounded border border-ink-200 bg-black object-contain" />
            <p className="mt-1 text-[0.68rem] leading-snug text-ink-500">What I can see. A frame is used only when you ask a question — nothing is recorded or stored.</p>
          </div>
        )}
      </div>
      <div className="border-t border-paper-300 p-2.5">
        {screen.error && <div className="mb-1.5 text-xs text-brick">{screen.error}</div>}
        {reference && <ReferenceChip reference={reference} onClear={() => setReference(null)} />}
        <ChatInput onSend={(t, mode) => send(t, undefined, false, mode)} busy={busy} lang={lang}
          placeholder="Type or speak a question or your answer — e.g. “What does this field mean?”"
          hint="I never ask for OTPs, passwords or PINs. Please don't share them." />
      </div>
      <EvidenceDrawer open={!!drawer} onClose={() => setDrawer(null)} evidence={drawer?.evidence ?? []} focusId={drawer?.focus} />
    </div>
  );
});

export default AssistantDock;
