import { Bot, MonitorOff, MonitorUp, PhoneOff } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { api } from "@/services/api";
import type { Evidence, FormAssistResponse, FormAssistSection, Lang } from "@/types";
import Markdown, { citationOrderFrom } from "@/components/Markdown";
import { EvidenceDrawer, SourcesButton } from "@/components/Evidence";
import ChatInput, { type InputMode } from "@/components/ChatInput";
import { QuoteButton, ReferenceChip, type ReferenceState } from "@/components/Reference";

interface Msg { id: string; role: "user" | "assistant" | "system"; sections: FormAssistSection[]; choices?: string[] | null }
interface Screen { active: boolean; error: string | null; stop: () => void; grabFrame: () => string | null; videoRef: React.MutableRefObject<HTMLVideoElement | null> }
export interface AssistantHandle { ask: (text: string, fieldId?: string) => void; getTranscript: () => string }
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
  const list = useRef<HTMLDivElement>(null);
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

  useImperativeHandle(ref, () => ({
    ask: (t, fid) => send(t, fid),
    getTranscript: () => messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${m.sections.map((s) => s.text).join(" ")}`)
      .join("\n"),
  }), [send, messages]);

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

  // Follow the conversation inside the list only (never the page). A long reply opens at its first line, not its end.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const last = el.querySelector<HTMLElement>("[data-last='true']");
    const fits = !last || last.offsetHeight <= el.clientHeight - 16;
    el.scrollTo({ top: busy || fits ? el.scrollHeight : Math.max(0, last.offsetTop - 8), behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => { // the pane can be hidden (phone view) or resized; jump to the latest message when it shows again
    const el = list.current;
    if (!el) return;
    let prev = el.clientHeight;
    const ro = new ResizeObserver(() => {
      if (prev === 0 && el.clientHeight > 0) el.scrollTop = el.scrollHeight;
      prev = el.clientHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const end = async () => {
    screen.stop();
    await api.post(`/api/forms/${formId}/assistant/end`).catch(() => undefined);
    onEnd();
  };

  const lastId = messages[messages.length - 1]?.id;
  const avatar = <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-forest-800 text-white"><Bot size={14} aria-hidden /></span>;
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      <div className="flex flex-none items-center gap-3 border-b border-paper-300 px-4 py-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-forest-800 text-white"><Bot size={19} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[0.97rem] font-bold leading-tight text-ink-900">AI Assistant</h2>
          <p className="mt-0.5 text-xs leading-snug text-ink-500">{summaryLine}</p>
        </div>
        {!screen.active && (
          <button className="btn-ghost btn-sm w-9 flex-none !px-0" title="Start AI Screen Assistance" aria-label="Start AI Screen Assistance" onClick={onStartScreen}><MonitorUp size={18} /></button>
        )}
        <button className="btn-ghost btn-sm w-9 flex-none !px-0 text-ink-500 hover:text-brick" title="End the assistant session" aria-label="End the assistant session" onClick={end}><PhoneOff size={17} /></button>
      </div>
      {screen.active && (
        <div className="flex flex-none items-center gap-3 border-b border-forest-100 bg-forest-50 px-4 py-2.5">
          <video ref={screen.videoRef} muted playsInline aria-label="Preview of the screen you are sharing" className="aspect-video w-24 flex-none rounded-md border border-forest-200 bg-black object-contain" />
          <div className="min-w-0 flex-1">
            <div role="status" className="flex items-center gap-1.5 text-xs font-bold text-forest-800"><span className="h-2 w-2 animate-pulse rounded-full bg-forest-500" /> Screen assistance is on</div>
            <p className="mt-0.5 text-[0.68rem] leading-snug text-ink-500">A frame is used only when you ask a question. Nothing is recorded or stored.</p>
          </div>
          <button className="btn-danger btn-sm flex-none" title="Stop screen assistance" onClick={screen.stop}><MonitorOff size={14} /> Stop</button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={list} className="relative min-h-0 flex-1 space-y-4 overflow-y-auto bg-ink-50 px-4 py-4" aria-live="polite">
          {messages.map((m) => {
            if (m.role === "user") return (
              <div key={m.id} data-last={m.id === lastId} className="flex justify-end">
                <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-lg rounded-br-sm bg-forest-700 px-3.5 py-2.5 text-[0.97rem] leading-relaxed text-white shadow-card">{m.sections[0].text}</div>
              </div>
            );
            if (m.role === "system") return (
              <div key={m.id} data-last={m.id === lastId} role="alert" className="break-words rounded-lg border border-brick-100 bg-brick-50 px-3 py-2 text-sm text-brick">{m.sections[0].text}</div>
            );
            return (
              <div key={m.id} data-last={m.id === lastId} className="flex items-start gap-2.5">
                {avatar}
                <div className="min-w-0 flex-1 space-y-1.5">
                  {m.sections.map((s, i) => {
                    const tag = TAG[s.kind];
                    const ev = s.evidence ?? [];
                    const order = citationOrderFrom(s.text, ev.map((e) => e.id));
                    const ordered = order.map((id) => ev.find((e) => e.id === id)!).filter(Boolean);
                    return (
                      <div key={i} className={`w-fit max-w-full break-words rounded-lg rounded-tl-sm border bg-white px-3.5 py-2.5 text-[0.97rem] shadow-card ${tag ? "border-forest-200" : "border-paper-300"}`}>
                        {tag && <span className={`chip mb-1.5 ${tag.cls}`}>{tag.label}</span>}
                        <Markdown text={s.text} citationOrder={order} onCite={(id) => setDrawer({ evidence: ordered, focus: id })} />
                        {ordered.length > 0 && <SourcesButton evidence={ordered} onOpen={() => setDrawer({ evidence: ordered })} />}
                      </div>
                    );
                  })}
                  <QuoteButton messageId={m.id} text={m.sections.map((s) => s.text).join(" ")} onSet={setReference} />
                  {m.id === lastId && m.choices && m.choices.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {m.choices.map((c) => (
                        <button key={c} disabled={busy} onClick={() => send(c)}
                          className="rounded-full border border-forest-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-50">{c}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {busy && (
            <div className="flex items-start gap-2.5" role="status">
              {avatar}
              <div className="flex items-center gap-2.5 rounded-lg rounded-tl-sm border border-paper-300 bg-white px-3.5 py-3 shadow-card">
                <span className="flex items-center gap-1" aria-hidden>
                  {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-forest-500" style={{ animationDelay: `${d}ms` }} />)}
                </span>
                <span className="text-xs text-ink-500">{screen.active ? "Looking at your screen and the form…" : "Thinking…"}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex-none border-t border-paper-300 bg-white p-3">
        {screen.error && <div className="mb-1.5 text-xs text-brick">{screen.error}</div>}
        {reference && <ReferenceChip reference={reference} onClear={() => setReference(null)} />}
        <ChatInput onSend={(t, mode) => send(t, undefined, false, mode)} busy={busy} lang={lang} compact
          placeholder="Type your answer or ask a question…"
          hint="I never ask for OTPs, passwords or PINs. Please don't share them." />
      </div>
      <EvidenceDrawer open={!!drawer} onClose={() => setDrawer(null)} evidence={drawer?.evidence ?? []} focusId={drawer?.focus} />
    </div>
  );
});

export default AssistantDock;
