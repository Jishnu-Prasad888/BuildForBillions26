import { AlertTriangle, Bot, Plus, Send, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import { speak, stopSpeaking, useSpeechInput } from "@/hooks/useSpeech";
import type { ChatMessage, Evidence, Lang } from "@/types";
import Markdown, { citationOrderFrom } from "@/components/Markdown";
import { EvidenceDrawer, SourcesButton } from "@/components/Evidence";
import SchemeCard from "@/components/SchemeCard";
import VoiceButton from "@/components/VoiceButton";
import KagTrace from "@/components/KagTrace";
import { Spinner } from "@/components/ui";

const SUGGESTIONS: Record<Lang, string[]> = {
  en: ["Heavy rain destroyed my crop. What help can I get?", "What documents do I need for crop damage relief?", "How many days do I have to report crop loss for insurance?", "Who is not eligible for PM-KISAN?"],
  hi: ["भारी बारिश से मेरी फसल बर्बाद हो गई। मुझे क्या मदद मिल सकती है?", "फसल नुकसान राहत के लिए कौन से दस्तावेज़ चाहिए?", "पीएम-किसान के लिए कौन पात्र नहीं है?"],
  kn: ["ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ಹಾನಿಯಾಗಿದೆ. ನನಗೆ ಏನು ಸಹಾಯ ಸಿಗುತ್ತದೆ?", "ಬೆಳೆ ಹಾನಿ ಪರಿಹಾರಕ್ಕೆ ಯಾವ ದಾಖಲೆಗಳು ಬೇಕು?", "ಪಿಎಂ-ಕಿಸಾನ್‌ಗೆ ಯಾರು ಅರ್ಹರಲ್ಲ?"],
};

const INTRO: Record<Lang, string> = {
  en: "Namaste! Tell me what happened, in your own words. I'll find government schemes that may help, and show you the official sources behind every answer.",
  hi: "नमस्ते! अपने शब्दों में बताइए क्या हुआ। मैं आपकी मदद करने वाली सरकारी योजनाएँ खोजूँगा और हर उत्तर के पीछे के आधिकारिक स्रोत दिखाऊँगा।",
  kn: "ನಮಸ್ಕಾರ! ಏನಾಯಿತು ಎಂದು ನಿಮ್ಮದೇ ಮಾತಿನಲ್ಲಿ ಹೇಳಿ. ಸಹಾಯ ಮಾಡಬಹುದಾದ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ, ಪ್ರತಿ ಉತ್ತರದ ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ತೋರಿಸುತ್ತೇನೆ.",
};

export default function Assistant() {
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tts, setTts] = useState(() => localStorage.getItem("sahayak.tts") === "1");
  const [drawer, setDrawer] = useState<{ evidence: Evidence[]; focus?: string | null } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setBusy(true);
    const tmp: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: msg, evidence: [] };
    setMessages((m) => [...m, tmp, { id: "pending", role: "assistant", content: "", evidence: [], pending: true }]);
    try {
      const r = await api.post<{ conversation_id: string; message: ChatMessage }>("/api/assistant/chat", { message: msg, conversation_id: conversationId, language: lang });
      setConversationId(r.conversation_id);
      setMessages((m) => [...m.filter((x) => x.id !== "pending"), r.message]);
      if (tts) speak(r.message.content, lang);
    } catch (e: any) {
      setMessages((m) => [...m.filter((x) => x.id !== "pending"), { id: `e-${Date.now()}`, role: "system", content: e.message, evidence: [] }]);
    } finally {
      setBusy(false);
    }
  };

  const voice = useSpeechInput(lang, (txt) => send(txt));

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const q = params.get("q");
    if (q) send(q);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="flex h-[calc(100dvh-13.5rem)] min-h-[480px] flex-col lg:h-[calc(100vh-10.5rem)] lg:min-h-[560px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Ask by voice or text · answers show their sources</div>
          <h1 className="font-display text-[1.8rem] font-bold">{t("assistant")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={`btn-secondary btn-sm ${tts ? "border-saffron" : ""}`} onClick={() => { const v = !tts; setTts(v); localStorage.setItem("sahayak.tts", v ? "1" : "0"); if (!v) stopSpeaking(); }} aria-pressed={tts} title={t("speak_answers")}>
            {tts ? <Volume2 size={16} /> : <VolumeX size={16} />} {t("speak_answers")}
          </button>
          <button className="btn-secondary btn-sm" onClick={() => { setMessages([]); setConversationId(null); stopSpeaking(); }}><Plus size={16} /> New</button>
        </div>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink-800 text-white"><Bot size={18} /></div>
            <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-paper-100 px-4 py-3 text-[1.02rem]">{INTRO[lang]}</div>
          </div>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 pl-12">
              {SUGGESTIONS[lang].map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-paper-300 bg-white px-3.5 py-2 text-left text-sm font-medium text-ink-700 hover:border-saffron hover:bg-saffron-50">{s}</button>
              ))}
            </div>
          )}
          {messages.map((m) => {
            if (m.role === "user")
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-xl rounded-2xl rounded-tr-sm bg-ink-800 px-4 py-3 text-[1.02rem] text-white">{m.content}</div>
                </div>
              );
            if (m.role === "system") return <div key={m.id} className="rounded-lg bg-brick-50 px-4 py-2 text-sm text-brick">{m.content}</div>;
            if (m.pending)
              return (
                <div key={m.id} className="flex items-center gap-3 pl-12 text-ink-500"><Spinner /> {t("thinking")}</div>
              );
            const order = citationOrderFrom(m.content, m.evidence.map((e) => e.id));
            const ordered = order.map((id) => m.evidence.find((e) => e.id === id)!).filter(Boolean);
            const cards = m.meta?.scheme_cards ?? [];
            return (
              <div key={m.id} className="flex gap-3">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink-800 text-white"><Bot size={18} /></div>
                <div className="min-w-0 max-w-3xl flex-1">
                  <div className="rounded-2xl rounded-tl-sm bg-paper-100 px-4 py-3 text-[1.02rem]">
                    {m.meta?.insufficient_evidence && (
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-saffron-700"><AlertTriangle size={16} /> Not verified by available sources</div>
                    )}
                    <Markdown text={m.content} citationOrder={order} onCite={(id) => setDrawer({ evidence: ordered, focus: id })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <SourcesButton evidence={ordered} onOpen={() => setDrawer({ evidence: ordered })} />
                    <button className="mt-2 text-sm font-semibold text-ink-500 hover:text-ink-800" onClick={() => speak(m.content, lang)}><Volume2 size={14} className="mr-1 inline" />Listen</button>
                  </div>
                  <KagTrace meta={{ ...m.meta }} cited={ordered.length} />
                  {cards.length > 0 && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {cards.map((s: any) => (
                        <SchemeCard key={s.code} scheme={s} evidence={ordered} onCite={(id) => setDrawer({ evidence: ordered, focus: id })} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>

        <form onSubmit={submit} className="border-t border-paper-300 bg-white p-3 sm:p-4">
          {(voice.listening || voice.interim) && <div className="mb-2 text-sm font-semibold text-saffron-700">{t("listening")} {voice.interim}</div>}
          {voice.error && <div className="mb-2 text-sm text-brick">{voice.error}</div>}
          <div className="flex items-center gap-2">
            <VoiceButton listening={voice.listening} onStart={voice.start} onStop={voice.stop} disabled={busy} />
            <input className="input py-3" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("ask_placeholder")} aria-label="Message" />
            <button className="btn-primary h-11" disabled={busy || !input.trim()}><Send size={17} /> <span className="hidden sm:inline">{t("send")}</span></button>
          </div>
        </form>
      </div>
      <EvidenceDrawer open={!!drawer} onClose={() => setDrawer(null)} evidence={drawer?.evidence ?? []} focusId={drawer?.focus} />
    </div>
  );
}
