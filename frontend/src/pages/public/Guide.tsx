import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, ClipboardCheck, Hand, Languages, ListChecks, LogIn, Mic,
  MonitorSmartphone, ShieldAlert, Square, Volume2,
} from "lucide-react";
import { useI18n, useTr, type Tri } from "@/i18n";
import { speak, stopSpeaking } from "@/hooks/useSpeech";

type Step = { icon: typeof Mic; title: Tri; text: Tri };

const STEPS: Step[] = [
  {
    icon: Languages,
    title: { en: "Choose language", hi: "भाषा चुनिए", kn: "ಭಾಷೆ ಆರಿಸಿ" },
    text: { en: "Pick English, हिन्दी or ಕನ್ನಡ.", hi: "English, हिन्दी या ಕನ್ನಡ चुनिए।", kn: "English, हिन्दी ಅಥವಾ ಕನ್ನಡ ಆರಿಸಿ." },
  },
  {
    icon: LogIn,
    title: { en: "Sign in", hi: "साइन इन करें", kn: "ಸೈನ್ ಇನ್ ಮಾಡಿ" },
    text: { en: "Use your email, or try the demo account.", hi: "ईमेल से साइन इन करें, या डेमो खाता आज़माएँ।", kn: "ಇಮೇಲ್ ಬಳಸಿ, ಅಥವಾ ಡೆಮೊ ಖಾತೆ ಪ್ರಯತ್ನಿಸಿ." },
  },
  {
    icon: Mic,
    title: { en: "Describe your problem", hi: "अपनी समस्या बताइए", kn: "ನಿಮ್ಮ ಸಮಸ್ಯೆ ಹೇಳಿ" },
    text: { en: "Press the mic and speak, or type.", hi: "माइक दबाकर बोलिए, या लिखिए।", kn: "ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ, ಅಥವಾ ಟೈಪ್ ಮಾಡಿ." },
  },
  {
    icon: BadgeCheck,
    title: { en: "Pick a scheme", hi: "योजना चुनिए", kn: "ಯೋಜನೆ ಆರಿಸಿ" },
    text: { en: "Review the matches and tap Apply.", hi: "मिली योजनाएँ देखें और आवेदन दबाएँ।", kn: "ಹೊಂದುವ ಯೋಜನೆ ನೋಡಿ, ಅರ್ಜಿ ಒತ್ತಿ." },
  },
  {
    icon: MonitorSmartphone,
    title: { en: "Fill the form", hi: "फ़ॉर्म भरिए", kn: "ಫಾರ್ಮ್ ತುಂಬಿರಿ" },
    text: { en: "Answer one question at a time.", hi: "एक बार में एक सवाल का जवाब दीजिए।", kn: "ಒಂದು ಬಾರಿಗೆ ಒಂದು ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಿ." },
  },
  {
    icon: Hand,
    title: { en: "Approve answers", hi: "जवाब मंज़ूर करें", kn: "ಉತ್ತರಗಳನ್ನು ಅನುಮೋದಿಸಿ" },
    text: { en: "Nothing is filled until you say yes.", hi: "आपकी हाँ के बिना कुछ नहीं भरता।", kn: "ನೀವು ಹೌದು ಎನ್ನುವವರೆಗೆ ಏನೂ ತುಂಬುವುದಿಲ್ಲ." },
  },
  {
    icon: ClipboardCheck,
    title: { en: "Review and submit", hi: "जाँचें और भेजें", kn: "ಪರಿಶೀಲಿಸಿ ಕಳುಹಿಸಿ" },
    text: { en: "Check everything, then submit.", hi: "सब जाँचें, फिर भेजें।", kn: "ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸಿ, ನಂತರ ಕಳುಹಿಸಿ." },
  },
  {
    icon: ListChecks,
    title: { en: "Track progress", hi: "प्रगति देखें", kn: "ಪ್ರಗತಿ ನೋಡಿ" },
    text: { en: "Open Applications to see status.", hi: "स्थिति देखने के लिए आवेदन खोलें।", kn: "ಸ್ಥಿತಿ ನೋಡಲು ಅರ್ಜಿಗಳನ್ನು ತೆರೆಯಿರಿ." },
  },
];

function ListenButton({ id, text, playing, setPlaying }: { id: string; text: string; playing: string | null; setPlaying: (v: string | null) => void }) {
  const { lang } = useI18n();
  const tr = useTr();
  const on = playing === id;
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${on ? "border-forest-800 bg-forest-800 text-white" : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50"}`}
      onClick={() => {
        stopSpeaking();
        if (on) return setPlaying(null);
        setPlaying(id);
        speak(text, lang, () => setPlaying(null));
      }}
      aria-pressed={on}
    >
      {on ? <Square size={12} /> : <Volume2 size={14} />}
      {on ? tr({ en: "Stop", hi: "रोकें", kn: "ನಿಲ್ಲಿಸಿ" }) : tr({ en: "Listen", hi: "सुनें", kn: "ಕೇಳಿ" })}
    </button>
  );
}

export default function Guide() {
  const tr = useTr();
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => stopSpeaking(), []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="border-b border-paper-300 pb-6">
        <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-700">{tr({ en: "User guide", hi: "उपयोगकर्ता गाइड", kn: "ಬಳಕೆದಾರ ಮಾರ್ಗದರ್ಶಿ" })}</div>
        <h1 className="mt-2 font-display text-3xl font-bold">{tr({ en: "How to use Sahayak", hi: "सहायक कैसे इस्तेमाल करें", kn: "ಸಹಾಯಕ ಬಳಸುವುದು ಹೇಗೆ" })}</h1>
      </div>

      <ol className="card mt-8 divide-y divide-paper-300 overflow-hidden">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title.en} className="flex items-center gap-4 p-4 transition-colors hover:bg-forest-50/50 sm:p-5">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-forest-800 text-sm font-bold text-white" aria-hidden>{i + 1}</span>
            <Icon size={20} className="hidden flex-none text-forest-600 sm:block" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-ink-900">{tr(title)}</h2>
              <p className="text-sm text-ink-600">{tr(text)}</p>
            </div>
            <ListenButton id={title.en} text={`${tr(title)}. ${tr(text)}`} playing={playing} setPlaying={setPlaying} />
          </li>
        ))}
      </ol>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-saffron-100 border-l-4 border-l-saffron bg-saffron-50 p-4 text-sm text-ink-800">
        <ShieldAlert size={20} className="mt-0.5 flex-none text-saffron-600" />
        <p>{tr({ en: "Never share an OTP, PIN or password. Sahayak will never ask for one.", hi: "OTP, PIN या पासवर्ड कभी साझा न करें। सहायक कभी नहीं माँगेगा।", kn: "OTP, PIN ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಎಂದಿಗೂ ಹಂಚಬೇಡಿ. ಸಹಾಯಕ ಎಂದಿಗೂ ಕೇಳುವುದಿಲ್ಲ." })}</p>
      </div>

      <div className="mt-8 text-center">
        <Link to="/assistant" className="btn-primary btn-lg">
          <Mic size={18} /> {tr({ en: "Talk to the assistant", hi: "सहायक से बात करें", kn: "ಸಹಾಯಕರೊಂದಿಗೆ ಮಾತನಾಡಿ" })} <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
