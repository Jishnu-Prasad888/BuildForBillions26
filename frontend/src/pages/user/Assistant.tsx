import { AlertTriangle, Bot, Plus, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/services/api";
import { useI18n } from "@/i18n";
import { speak, stopSpeaking } from "@/hooks/useSpeech";
import type { ChatMessage, Evidence, Lang } from "@/types";
import Markdown, { citationOrderFrom } from "@/components/Markdown";
import { EvidenceDrawer, SourcesButton } from "@/components/Evidence";
import SchemeCard from "@/components/SchemeCard";
import ChatInput, { type InputMode } from "@/components/ChatInput";
import KagTrace from "@/components/KagTrace";
import { Spinner } from "@/components/ui";
import { QuoteButton, ReferenceChip, type ReferenceState } from "@/components/Reference";

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
  const [busy, setBusy] = useState(false);
  const [chatKey, setChatKey] = useState(0); // bumped by "New" to clear the input box
  const [tts, setTts] = useState(() => localStorage.getItem("sahayak.tts") === "1");
  const [drawer, setDrawer] = useState<{ evidence: Evidence[]; focus?: string | null } | null>(null);
  const [reference, setReference] = useState<ReferenceState | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const send = async (text: string, mode: InputMode = "text") => {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true);
    const tmp: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: msg, evidence: [] };
    setMessages((m) => [...m, tmp, { id: "pending", role: "assistant", content: "", evidence: [], pending: true }]);
    const ref = reference;
    setReference(null);
    try {
      const r = await api.post<{ conversation_id: string; message: ChatMessage }>("/api/assistant/chat", {
        message: msg, conversation_id: conversationId, language: lang, input_mode: mode,
        ...(ref ? { reference_message_id: ref.id, reference_text: ref.text.slice(0, 1200) } : {}),
      });
      setConversationId(r.conversation_id);
      setMessages((m) => [...m.filter((x) => x.id !== "pending"), r.message]);
      if (tts) speak(r.message.content, lang);
    } catch (e: any) {
      setMessages((m) => [...m.filter((x) => x.id !== "pending"), { id: `e-${Date.now()}`, role: "system", content: e.message, evidence: [] }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const q = params.get("q");
    if (q) send(q);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <button className="btn-secondary btn-sm" onClick={() => { setMessages([]); setConversationId(null); setChatKey((k) => k + 1); stopSpeaking(); }}><Plus size={16} /> New</button>
        </div>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-forest-800 text-white"><Bot size={18} /></div>
            <div className="max-w-2xl rounded-lg rounded-tl-sm bg-paper-100 px-4 py-3 text-[1.02rem]">{INTRO[lang]}</div>
          </div>
          {messages.length === 0 && (
            <div className="stagger flex flex-wrap gap-2 pl-12">
              {SUGGESTIONS[lang].map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-paper-300 bg-white px-3.5 py-2 text-left text-sm font-medium text-ink-700 transition-all hover:-translate-y-0.5 hover:border-saffron hover:bg-saffron-50 hover:shadow-card">{s}</button>
              ))}
            </div>
          )}
          {messages.map((m) => {
            if (m.role === "user")
              return (
                <div key={m.id} className="flex animate-popIn justify-end">
                  <div className="max-w-xl rounded-lg rounded-tr-sm bg-ink-800 px-4 py-3 text-[1.02rem] text-white">{m.content}</div>
                </div>
              );
            if (m.role === "system") return <div key={m.id} className="animate-popIn rounded-lg bg-brick-50 px-4 py-2 text-sm text-brick">{m.content}</div>;
            if (m.pending)
              return (
                <div key={m.id} className="flex animate-fadeIn items-center gap-3 pl-12 text-ink-500">
                  <span className="flex gap-1" aria-hidden>{[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-forest-500" style={{ animationDelay: `${d}ms` }} />)}</span>
                  {t("thinking")}
                </div>
              );
            const order = citationOrderFrom(m.content, m.evidence.map((e) => e.id));
            const ordered = order.map((id) => m.evidence.find((e) => e.id === id)!).filter(Boolean);
            const cards = m.meta?.scheme_cards ?? [];
            const isRef = reference?.id === m.id;
            return (
              <div key={m.id} className={`flex gap-3 ${isRef ? "ring-2 ring-forest-300 ring-offset-2 rounded-2xl" : ""}`}>
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-forest-800 text-white"><Bot size={18} /></div>
                <div className="min-w-0 max-w-3xl flex-1">
                  <div className="rounded-lg rounded-tl-sm bg-paper-100 px-4 py-3 text-[1.02rem]">
                    {m.meta?.insufficient_evidence && (
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700"><AlertTriangle size={16} /> Not verified by available sources</div>
                    )}
                    <Markdown text={m.content} citationOrder={order} onCite={(id) => setDrawer({ evidence: ordered, focus: id })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <SourcesButton evidence={ordered} onOpen={() => setDrawer({ evidence: ordered })} />
                    <button className="mt-2 text-sm font-semibold text-ink-500 hover:text-ink-800" onClick={() => speak(m.content, lang)}><Volume2 size={14} className="mr-1 inline" />{t("listen")}</button>
                    {!m.pending && <QuoteButton messageId={m.id} text={m.content} onSet={setReference} />}
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

        <div className="border-t border-paper-300 bg-white p-3 sm:p-4">
          {reference && <ReferenceChip reference={reference} onClear={() => setReference(null)} />}
          <ChatInput onSend={send} busy={busy} resetKey={chatKey} />
        </div>
      </div>
      <EvidenceDrawer open={!!drawer} onClose={() => setDrawer(null)} evidence={drawer?.evidence ?? []} focusId={drawer?.focus} />
    </div>
  );
}
