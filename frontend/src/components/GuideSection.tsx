import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldAlert, Square, Volume2 } from "lucide-react";
import { useI18n, useTr, type Tri } from "@/i18n";
import { speak, stopSpeaking } from "@/hooks/useSpeech";

type Step = { title: Tri; text: Tri };

const STEPS: Step[] = [
  {
    title: { en: "Choose language", hi: "भाषा चुनिए", kn: "ಭಾಷೆ ಆರಿಸಿ" },
    text: { en: "Pick English, हिन्दी or ಕನ್ನಡ.", hi: "English, हिन्दी या ಕನ್ನಡ चुनिए।", kn: "English, हिन्दी ಅಥವಾ ಕನ್ನಡ ಆರಿಸಿ." },
  },
  {
    title: { en: "Sign in", hi: "साइन इन करें", kn: "ಸೈನ್ ಇನ್ ಮಾಡಿ" },
    text: { en: "Use your email, or the sample account.", hi: "ईमेल से साइन इन करें, या नमूना खाता उपयोग करें।", kn: "ಇಮೇಲ್ ಬಳಸಿ, ಅಥವಾ ಮಾದರಿ ಖಾತೆ ಬಳಸಿ." },
  },
  {
    title: { en: "Describe your problem", hi: "अपनी समस्या बताइए", kn: "ನಿಮ್ಮ ಸಮಸ್ಯೆ ಹೇಳಿ" },
    text: { en: "Press the mic and speak, or type.", hi: "माइक दबाकर बोलिए, या लिखिए।", kn: "ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ, ಅಥವಾ ಟೈಪ್ ಮಾಡಿ." },
  },
  {
    title: { en: "Pick a scheme", hi: "योजना चुनिए", kn: "ಯೋಜನೆ ಆರಿಸಿ" },
    text: { en: "Review the matches and tap Apply.", hi: "मिली योजनाएँ देखें और आवेदन दबाएँ।", kn: "ಹೊಂದುವ ಯೋಜನೆ ನೋಡಿ, ಅರ್ಜಿ ಒತ್ತಿ." },
  },
  {
    title: { en: "Fill the form", hi: "फ़ॉर्म भरिए", kn: "ಫಾರ್ಮ್ ತುಂಬಿರಿ" },
    text: { en: "Answer one question at a time.", hi: "एक बार में एक सवाल का जवाब दीजिए।", kn: "ಒಂದು ಬಾರಿಗೆ ಒಂದು ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಿ." },
  },
  {
    title: { en: "Approve answers", hi: "जवाब मंज़ूर करें", kn: "ಉತ್ತರಗಳನ್ನು ಅನುಮೋದಿಸಿ" },
    text: { en: "Nothing is filled until you say yes.", hi: "आपकी हाँ के बिना कुछ नहीं भरता।", kn: "ನೀವು ಹೌದು ಎನ್ನುವವರೆಗೆ ಏನೂ ತುಂಬುವುದಿಲ್ಲ." },
  },
  {
    title: { en: "Review and submit", hi: "जाँचें और भेजें", kn: "ಪರಿಶೀಲಿಸಿ ಕಳುಹಿಸಿ" },
    text: { en: "Check everything, then submit.", hi: "सब जाँचें, फिर भेजें।", kn: "ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸಿ, ನಂತರ ಕಳುಹಿಸಿ." },
  },
  {
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
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors ${on ? "border-forest-800 bg-forest-800 text-white" : "border-ink-200 bg-white text-ink-700 hover:border-forest-300 hover:bg-forest-50"}`}
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

/* The step-by-step user guide. Lives on the landing page, directly below the hero. */
export default function GuideSection() {
  const tr = useTr();
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => stopSpeaking(), []);

  return (
    <section id="guide" className="scroll-mt-28 border-b border-paper-300 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="border-b border-paper-300 pb-5">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-700">{tr({ en: "User guide", hi: "उपयोगकर्ता गाइड", kn: "ಬಳಕೆದಾರ ಮಾರ್ಗದರ್ಶಿ" })}</div>
          <h2 className="mt-1.5 font-display text-2xl font-bold text-forest-900 sm:text-3xl">{tr({ en: "How to use Sahayak", hi: "सहायक कैसे इस्तेमाल करें", kn: "ಸಹಾಯಕ ಬಳಸುವುದು ಹೇಗೆ" })}</h2>
        </div>

        <ol className="card mt-6 divide-y divide-paper-300 overflow-hidden">
          {STEPS.map(({ title, text }, i) => (
            <li key={title.en} className="flex items-center gap-4 p-4 transition-colors hover:bg-forest-50/60 sm:p-5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-forest-200 bg-forest-50 text-sm font-bold text-forest-800" aria-hidden>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-ink-900">{tr(title)}</h3>
                <p className="text-sm text-ink-600">{tr(text)}</p>
              </div>
              <ListenButton id={title.en} text={`${tr(title)}. ${tr(text)}`} playing={playing} setPlaying={setPlaying} />
            </li>
          ))}
        </ol>

        <div className="mt-6 flex items-start gap-3 rounded-md border border-amber-100 border-l-4 border-l-amber bg-amber-50 p-4 text-sm text-ink-800">
          <ShieldAlert size={20} className="mt-0.5 flex-none text-amber-600" />
          <p>{tr({ en: "Never share an OTP, PIN or password. Sahayak will never ask for one.", hi: "OTP, PIN या पासवर्ड कभी साझा न करें। सहायक कभी नहीं माँगेगा।", kn: "OTP, PIN ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಎಂದಿಗೂ ಹಂಚಬೇಡಿ. ಸಹಾಯಕ ಎಂದಿಗೂ ಕೇಳುವುದಿಲ್ಲ." })}</p>
        </div>

        <div className="mt-8 text-center">
          <Link to="/assistant" className="btn-primary btn-lg">
            {tr({ en: "Talk to the assistant", hi: "सहायक से बात करें", kn: "ಸಹಾಯಕರೊಂದಿಗೆ ಮಾತನಾಡಿ" })} <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
