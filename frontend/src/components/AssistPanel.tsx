import { Bot, Check, Keyboard, X, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Plus, Send, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import { speak, stopSpeaking, useSpeechInput } from "@/hooks/useSpeech";
import type { AssistResponse, ChatMessage, Evidence, Lang } from "@/types";
import Markdown, { citationOrderFrom } from "./Markdown";
import { EvidenceDrawer, SourcesButton } from "./Evidence";
import VoiceButton from "./VoiceButton";
import LanguageSwitcher from "./LanguageSwitcher";
import { Spinner } from "./ui";

interface ScreenContext {
  visible_fields: { id: string; label: string; required: boolean; filled: boolean }[];
  focused_field_id: string | null;
  buttons: string[];
  warnings: string[];
  values: Record<string, any>;
  frame?: string | null;
}

interface Props {
  applicationId: string;
  sessionId: string;
  initial: AssistResponse;
  lang: Lang;
  setLang: (l: Lang) => void;
  screen: { active: boolean; error: string | null; start: () => Promise<boolean>; stop: () => void; grabFrame: () => string | null; videoRef: React.MutableRefObject<HTMLVideoElement | null> };
  collectScreen: () => ScreenContext;
  onResponse: (r: AssistResponse) => void;
  onAddNote: (content: string, item_type: "todo" | "question") => Promise<void>;
  onEnd: () => void;
}

type Msg = ChatMessage & { suggestions?: AssistResponse["suggested_notes"]; pendingFill?: AssistResponse["pending_fill"] };

// Screen frames are only needed to answer questions; keep in sync with QUESTION_RE in backend form_assistant.py.
const QUESTION_RE = /\?|^\s*(what|where|which|how|why|who|when|do|does|is|are|can|could|should|will|explain|tell me)\b|क्या|कहाँ|कहां|कैसे|क्यों|कौन|मतलब|ಏನು|ಎಲ್ಲಿ|ಹೇಗೆ|ಯಾಕೆ|ಯಾವ|ಬೇಕೆ|ಬೇಕಾ|ಅರ್ಥ/i;
const YES_WORD: Record<Lang, string> = { en: "Yes", hi: "हाँ", kn: "ಹೌದು" };
const NO_WORD: Record<Lang, string> = { en: "No", hi: "नहीं", kn: "ಇಲ್ಲ" };

export default function AssistPanel({ sessionId, initial, lang, setLang, screen, collectScreen, onResponse, onAddNote, onEnd }: Props) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([
    { id: "greet", role: "assistant", content: initial.reply, evidence: initial.evidence, suggestions: initial.suggested_notes },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [typing, setTyping] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [bigPreview, setBigPreview] = useState(true);
  const [drawer, setDrawer] = useState<{ evidence: Evidence[]; focus?: string | null } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const micOnRef = useRef(micOn);
  micOnRef.current = micOn;

  const voice = useSpeechInput(lang, (txt) => send(txt));
  useEffect(() => {
    if (voice.error) setMicOn(false); // e.g. permission denied: stop hands-free listening
  }, [voice.error]);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const afterReply = useCallback(
    (text: string) => {
      const listenAgain = () => micOnRef.current && voiceRef.current.supported && setTimeout(() => voiceRef.current.start(), 350);
      if (!muted) speak(text, lang, listenAgain);
      else listenAgain();
    },
    [muted, lang],
  );

  useEffect(() => {
    afterReply(initial.reply);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    stopSpeaking();
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: msg, evidence: [] }]);
    try {
      const ctx = collectScreen();
      const frame = screen.active && QUESTION_RE.test(msg) ? screen.grabFrame() : null;
      const r = await api.post<AssistResponse>(`/api/screen-assistance/sessions/${sessionId}/messages`, { text: msg, language: lang, screen: { ...ctx, frame } });
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: r.reply, evidence: r.evidence, suggestions: r.suggested_notes, pendingFill: r.pending_fill }]);
      onResponse(r);
      afterReply(r.reply);
    } catch (e: any) {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "system", content: e.message, evidence: [] }]);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const end = async () => {
    stopSpeaking();
    voice.stop();
    screen.stop();
    await api.post(`/api/screen-assistance/sessions/${sessionId}/end`).catch(() => undefined);
    onEnd();
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-ink-200 bg-white shadow-card">
      <div className="rounded-t-xl bg-ink-800 px-4 py-3 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold"><Bot size={18} /> AI Form Assistant</div>
          <LanguageSwitcher compact value={lang} onChange={setLang} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          {screen.active ? (
            <>
              <span role="status" className="flex flex-1 items-center gap-1.5 rounded-md bg-leaf px-2 py-1.5 font-semibold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Screen sharing active
              </span>
              <button onClick={screen.stop} className="flex items-center gap-1.5 rounded-md bg-brick px-2 py-1.5 font-semibold hover:bg-brick/90">
                <MonitorOff size={14} /> Stop Sharing
              </button>
            </>
          ) : (
            <button onClick={() => screen.start()} className="flex flex-1 items-center gap-1.5 rounded-md bg-ink-700 px-2 py-1.5 font-semibold text-ink-200 hover:bg-ink-600">
              <MonitorUp size={14} /> Screen sharing off — share screen
            </button>
          )}
          <button onClick={() => { const v = !micOn; setMicOn(v); if (!v) voice.stop(); }} aria-pressed={micOn} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 font-semibold ${micOn ? "bg-leaf text-white" : "bg-ink-700 text-ink-200"}`}>
            {micOn ? <Mic size={14} /> : <MicOff size={14} />} Mic {micOn ? "on" : "off"}
          </button>
        </div>
        {!screen.active && screen.error && <p className="mt-2 text-xs text-amber-100">{screen.error}</p>}
        <div className={screen.active ? "mt-2.5" : "hidden"}>
          <div className={bigPreview ? "" : "flex items-center gap-2.5"}>
            <video ref={screen.videoRef} muted playsInline aria-label="Preview of your shared screen"
              className={`rounded border border-ink-600 bg-black ${bigPreview ? "aspect-video w-full object-contain" : "h-14 w-24 flex-none object-cover"}`} />
            <div className={`flex items-start justify-between gap-2 ${bigPreview ? "mt-1.5" : "flex-1"}`}>
              <p className="text-[0.7rem] leading-snug text-ink-200">What the AI sees. A frame is captured only when you ask a question — nothing is recorded or stored.</p>
              <button onClick={() => setBigPreview((b) => !b)} className="whitespace-nowrap text-[0.7rem] font-semibold text-ink-200 underline hover:text-white">
                {bigPreview ? "Shrink" : "Enlarge"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-4" aria-live="polite">
        {messages.map((m) => {
          if (m.role === "user") return <div key={m.id} className="ml-8 rounded-lg rounded-tr-sm bg-ink-100 px-3.5 py-2 text-[0.97rem] text-ink-900">{m.content}</div>;
          if (m.role === "system") return <div key={m.id} className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick">{m.content}</div>;
          const order = citationOrderFrom(m.content, m.evidence.map((e) => e.id));
          const ordered = order.map((id) => m.evidence.find((e) => e.id === id)!).filter(Boolean);
          return (
            <div key={m.id} className="mr-3">
              <div className="rounded-lg rounded-tl-sm border border-paper-300 bg-paper-100 px-3.5 py-2.5 text-[0.97rem]">
                <Markdown text={m.content} citationOrder={order} onCite={(id) => setDrawer({ evidence: ordered, focus: id })} />
              </div>
              <SourcesButton evidence={ordered} onOpen={() => setDrawer({ evidence: ordered })} />
              {m.pendingFill && m.id === messages[messages.length - 1]?.id && (
                <div className="mt-2 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm">
                  <div className="text-ink-600">Fill <b>{m.pendingFill.label}</b> with:</div>
                  <div className="my-1 font-semibold text-ink-900">“{m.pendingFill.display}”</div>
                  <div className="mt-2 flex gap-2">
                    <button className="btn-primary btn-sm" disabled={busy} onClick={() => send(YES_WORD[lang])}><Check size={15} /> {t("fill_field")}</button>
                    <button className="btn-secondary btn-sm" disabled={busy} onClick={() => send(NO_WORD[lang])}><X size={15} /> {t("dont_fill")}</button>
                  </div>
                </div>
              )}
              {m.suggestions?.map((s) => (
                <div key={s.content} className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-amber-100 bg-amber-50 px-3 py-2 text-sm">
                  <span className="text-amber-700">Suggested note: <b>{s.content}</b></span>
                  <button disabled={added.includes(s.content)} className="btn-secondary btn-sm whitespace-nowrap py-1"
                    onClick={async () => { await onAddNote(s.content, s.item_type); setAdded((a) => [...a, s.content]); }}>
                    {added.includes(s.content) ? "Added" : <><Plus size={14} /> {t("add_to_notes")}</>}
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        {busy && <div className="flex items-center gap-2 text-sm text-ink-500"><Spinner /> {screen.active ? "Looking at your screen and official sources…" : t("thinking")}</div>}
        <div ref={bottom} />
      </div>

      <div className="border-t border-paper-300 p-3">
        {(voice.listening || voice.interim) && <div className="mb-2 text-sm font-semibold text-saffron-700">{t("listening")} {voice.interim}</div>}
        {voice.error && <div className="mb-2 text-xs text-brick">{voice.error}</div>}
        <form onSubmit={submit} className="flex items-center gap-2">
          <VoiceButton listening={voice.listening} onStart={voice.start} onStop={voice.stop} disabled={busy} />
          {(typing || !voice.supported) ? (
            <>
              <input ref={inputRef} className="input py-2.5" value={input} onChange={(e) => setInput(e.target.value)} placeholder='e.g. "What should I put here?"' aria-label="Message" />
              <button className="btn-primary h-11 px-3" disabled={busy || !input.trim()} aria-label="Send"><Send size={17} /></button>
            </>
          ) : (
            <button type="button" onClick={() => voice.start()} className="flex-1 rounded-lg border border-dashed border-ink-200 px-3 py-2.5 text-left text-sm text-ink-500">
              Tap the mic and speak, e.g. “What should I put here?”
            </button>
          )}
        </form>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <button className="btn-secondary btn-sm" onClick={() => { const v = !muted; setMuted(v); if (v) stopSpeaking(); }} aria-pressed={muted}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />} {muted ? t("unmute") : t("mute")}
          </button>
          <button className="btn-secondary btn-sm" onClick={() => { setTyping(true); setTimeout(() => inputRef.current?.focus(), 50); }}>
            <Keyboard size={15} /> {t("type")}
          </button>
          <button className="btn-danger btn-sm" onClick={end}><PhoneOff size={15} /> End</button>
        </div>
      </div>
      <EvidenceDrawer open={!!drawer} onClose={() => setDrawer(null)} evidence={drawer?.evidence ?? []} focusId={drawer?.focus} />
    </div>
  );
}
