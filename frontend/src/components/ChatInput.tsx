import { Lock, Send } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { LANGUAGES, useI18n } from "@/i18n";
import { useSpeechInput } from "@/hooks/useSpeech";
import type { Lang } from "@/types";
import VoiceButton from "./VoiceButton";
import LanguageMenu from "./LanguageMenu";

export type InputMode = "text" | "voice";
export interface ChatInputHandle { focus: () => void; setDraft: (text: string) => void }

interface Props {
  /** Called only from the Send button or Enter. Voice never sends by itself. */
  onSend: (text: string, mode: InputMode) => void;
  busy?: boolean;
  placeholder?: string;
  /** Initial speech-recognition language; defaults to the app language. */
  lang?: Lang;
  maxLength?: number;
  /** Shown under the box (e.g. a safety note). */
  hint?: ReactNode;
  /** Voice/typing drafts are also stopped when this changes (e.g. the chat is reset). */
  resetKey?: string | number;
  /** Panel layout: one rounded composer with the mic, language menu and Send on a toolbar under the text box. */
  compact?: boolean;
}

const SHORT: Record<Lang, string> = { en: "EN", hi: "हिं", kn: "ಕ" };

/**
 * The one message box used by every chat: typing and speech fill the same draft and leave through the same onSend.
 * Speech only writes into the draft (interim words appear live) so the citizen can check and edit before sending.
 */
const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput(
  { onSend, busy = false, placeholder, lang, maxLength = 1000, hint, resetKey, compact = false }, ref,
) {
  const { lang: appLang, t } = useI18n();
  const [draft, setDraft] = useState("");
  const [sttLang, setSttLang] = useState<Lang>(lang ?? appLang);
  const usedVoice = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setSttLang(lang ?? appLang); }, [lang, appLang]);

  const voice = useSpeechInput(sttLang, (spoken) => {
    usedVoice.current = true;
    setDraft((d) => (d.trim() ? `${d.trimEnd()} ${spoken}` : spoken).slice(0, maxLength));
  });

  useEffect(() => { voice.stop(); setDraft(""); usedVoice.current = false; }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    focus: () => box.current?.focus(),
    setDraft: (text: string) => { setDraft(text); box.current?.focus(); },
  }), []);

  // Interim speech is shown at the end of the draft while the person is still talking.
  const interim = voice.interim.trim();
  const shown = interim ? (draft.trim() ? `${draft.trimEnd()} ${interim}` : interim) : draft;

  useEffect(() => { // grow with the text, up to about five lines
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [shown]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    voice.stop();
    onSend(text, usedVoice.current ? "voice" : "text");
    setDraft("");
    usedVoice.current = false;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Indic keyboards compose characters with Enter; never send in the middle of that.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    submit();
  };

  const langSelect = voice.supported && (
    <select
      aria-label="Voice input language"
      title="Language you will speak in"
      className="rounded-md border border-ink-200 bg-white px-1 py-0.5 text-[0.7rem] font-semibold text-ink-700"
      value={sttLang}
      onChange={(e) => { voice.stop(); setSttLang(e.target.value as Lang); }}
    >
      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{SHORT[l.code]}</option>)}
    </select>
  );

  return (
    <div>
      {voice.listening && (
        <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-saffron-700" role="status">
          <span className="h-2 w-2 animate-pulse rounded-full bg-saffron" /> {t("listening")} <span className="font-normal text-ink-500">— tap the mic again to stop, then press Send</span>
        </div>
      )}
      {voice.error && <div className="mb-1.5 text-sm text-brick" role="alert">{voice.error}</div>}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className={compact
          ? "rounded-lg border border-ink-200 bg-white transition-colors focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/20"
          : "flex items-end gap-2"}
      >
        {!compact && voice.supported && (
          <div className="flex flex-none flex-col items-center gap-1">
            <VoiceButton listening={voice.listening} onStart={voice.start} onStop={voice.stop} disabled={busy} />
            {langSelect}
          </div>
        )}
        <textarea
          ref={box}
          rows={1}
          className={compact
            ? "block min-h-[44px] w-full resize-none rounded-lg bg-transparent px-3 pb-1 pt-2.5 leading-snug text-ink-900 placeholder:text-ink-400 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            : "input min-h-[44px] resize-none py-2.5 leading-snug"}
          value={shown}
          onChange={(e) => {
            const v = e.target.value;
            // Typing while speech is still arriving: keep what was typed, the interim words will come back as final.
            setDraft(interim && v.endsWith(interim) ? v.slice(0, -interim.length).trimEnd() : v);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t("ask_placeholder")}
          aria-label="Message"
          maxLength={maxLength}
        />
        {compact ? (
          <div className="flex items-center gap-2 px-2 pb-2">
            {voice.supported && (
              <>
                <VoiceButton size="sm" listening={voice.listening} onStart={voice.start} onStop={voice.stop} disabled={busy} />
                <LanguageMenu value={sttLang} onChange={(l) => { voice.stop(); setSttLang(l); }} />
              </>
            )}
            <button className="btn-primary btn-sm ml-auto" disabled={busy || !draft.trim()} aria-label={t("send")}>
              <Send size={16} /> {t("send")}
            </button>
          </div>
        ) : (
          <button className="btn-primary h-11 flex-none px-3 sm:px-4" disabled={busy || !draft.trim()} aria-label={t("send")}>
            <Send size={17} /> <span className="hidden sm:inline">{t("send")}</span>
          </button>
        )}
      </form>
      {hint && (compact
        ? <div className="mt-2 flex items-start gap-1.5 text-[0.72rem] leading-snug text-ink-400"><Lock size={11} className="mt-[3px] flex-none" aria-hidden />{hint}</div>
        : <div className="mt-1.5 text-[0.72rem] text-ink-400">{hint}</div>)}
    </div>
  );
});

export default ChatInput;
