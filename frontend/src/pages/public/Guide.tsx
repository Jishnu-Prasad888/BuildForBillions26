import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, CircleHelp, ClipboardCheck, FileText, Hand, Languages, ListChecks, LogIn, Mic,
  MonitorSmartphone, Search, ShieldAlert, Smartphone, Square, Volume2,
} from "lucide-react";
import { useI18n, useTr, type Tri } from "@/i18n";
import { speak, stopSpeaking } from "@/hooks/useSpeech";

type Step = { icon: typeof Mic; title: Tri; text: Tri; tip?: Tri };

const STEPS: Step[] = [
  {
    icon: Languages,
    title: { en: "Choose your language", hi: "अपनी भाषा चुनिए", kn: "ನಿಮ್ಮ ಭಾಷೆ ಆರಿಸಿ" },
    text: {
      en: "At the top of the screen, tap the language box and pick English, हिन्दी or ಕನ್ನಡ. Everything, including the voice, changes to that language.",
      hi: "स्क्रीन के ऊपर भाषा वाले डिब्बे पर दबाइए और English, हिन्दी या ಕನ್ನಡ चुनिए। सब कुछ, आवाज़ भी, उसी भाषा में हो जाएगा।",
      kn: "ಪರದೆಯ ಮೇಲ್ಭಾಗದಲ್ಲಿ ಭಾಷೆಯ ಪೆಟ್ಟಿಗೆ ಒತ್ತಿ English, हिन्दी ಅಥವಾ ಕನ್ನಡ ಆರಿಸಿ. ಧ್ವನಿಯೂ ಸೇರಿದಂತೆ ಎಲ್ಲವೂ ಆ ಭಾಷೆಗೆ ಬದಲಾಗುತ್ತದೆ.",
    },
  },
  {
    icon: LogIn,
    title: { en: "Sign in", hi: "साइन इन कीजिए", kn: "ಸೈನ್ ಇನ್ ಮಾಡಿ" },
    text: {
      en: "Tap “Sign in” and enter your email and password. New here? Tap “Create an account”. To only practise, tap “Try the demo”.",
      hi: "“साइन इन” दबाइए और अपना ईमेल और पासवर्ड डालिए। पहली बार? “खाता बनाएँ” दबाइए। सिर्फ़ अभ्यास के लिए “डेमो आज़माएँ” दबाइए।",
      kn: "“ಸೈನ್ ಇನ್” ಒತ್ತಿ ನಿಮ್ಮ ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಹಾಕಿ. ಹೊಸಬರೇ? “ಖಾತೆ ರಚಿಸಿ” ಒತ್ತಿ. ಅಭ್ಯಾಸಕ್ಕೆ ಮಾತ್ರ “ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ” ಒತ್ತಿ.",
    },
  },
  {
    icon: Mic,
    title: { en: "Tell the assistant your problem", hi: "सहायक को अपनी समस्या बताइए", kn: "ಸಹಾಯಕನಿಗೆ ನಿಮ್ಮ ಸಮಸ್ಯೆ ಹೇಳಿ" },
    text: {
      en: "Open “Assistant”. Press the round microphone button, speak, then press it again. You can also type. Say it in your own words.",
      hi: "“सहायक” खोलिए। गोल माइक बटन दबाइए, बोलिए, फिर दोबारा दबाइए। आप लिख भी सकते हैं। अपने शब्दों में बताइए।",
      kn: "“ಸಹಾಯಕ” ತೆರೆಯಿರಿ. ದುಂಡನೆಯ ಮೈಕ್ ಬಟನ್ ಒತ್ತಿ, ಮಾತನಾಡಿ, ನಂತರ ಮತ್ತೆ ಒತ್ತಿ. ನೀವು ಟೈಪ್ ಕೂಡ ಮಾಡಬಹುದು. ನಿಮ್ಮದೇ ಮಾತಿನಲ್ಲಿ ಹೇಳಿ.",
    },
    tip: {
      en: "Example: “Heavy rain destroyed my crop. What help can I get?”",
      hi: "उदाहरण: “भारी बारिश से मेरी फसल बर्बाद हो गई। मुझे क्या मदद मिल सकती है?”",
      kn: "ಉದಾಹರಣೆ: “ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ಹಾಳಾಯಿತು. ನನಗೆ ಯಾವ ಸಹಾಯ ಸಿಗಬಹುದು?”",
    },
  },
  {
    icon: BadgeCheck,
    title: { en: "Read or listen to the answer", hi: "जवाब पढ़िए या सुनिए", kn: "ಉತ್ತರ ಓದಿ ಅಥವಾ ಕೇಳಿ" },
    text: {
      en: "Tap “Listen” to hear the answer. Small numbers like [1] show where the answer came from — tap one to see the official paper.",
      hi: "जवाब सुनने के लिए “सुनें” दबाइए। [1] जैसे छोटे नंबर बताते हैं कि जवाब कहाँ से आया — आधिकारिक कागज़ देखने के लिए उस पर दबाइए।",
      kn: "ಉತ್ತರ ಕೇಳಲು “ಕೇಳಿ” ಒತ್ತಿ. [1] ಹಾಗಿನ ಸಣ್ಣ ಸಂಖ್ಯೆಗಳು ಉತ್ತರ ಎಲ್ಲಿಂದ ಬಂತು ಎಂದು ತೋರಿಸುತ್ತವೆ — ಅಧಿಕೃತ ದಾಖಲೆ ನೋಡಲು ಅದನ್ನು ಒತ್ತಿ.",
    },
  },
  {
    icon: Search,
    title: { en: "Pick a scheme and tap Apply", hi: "योजना चुनिए और “आवेदन करें” दबाइए", kn: "ಯೋಜನೆ ಆರಿಸಿ “ಅರ್ಜಿ ಸಲ್ಲಿಸಿ” ಒತ್ತಿ" },
    text: {
      en: "Under the answer you will see scheme cards. Each shows the money or help you get and the papers you need. Tap the orange “Apply” button.",
      hi: "जवाब के नीचे योजना के कार्ड दिखेंगे। हर कार्ड में मिलने वाली मदद और ज़रूरी कागज़ लिखे हैं। नारंगी “आवेदन करें” बटन दबाइए।",
      kn: "ಉತ್ತರದ ಕೆಳಗೆ ಯೋಜನೆಯ ಕಾರ್ಡ್‌ಗಳು ಕಾಣುತ್ತವೆ. ಪ್ರತಿಯೊಂದರಲ್ಲೂ ಸಿಗುವ ಸಹಾಯ ಮತ್ತು ಬೇಕಾದ ದಾಖಲೆಗಳು ಇವೆ. ಕಿತ್ತಳೆ ಬಣ್ಣದ “ಅರ್ಜಿ ಸಲ್ಲಿಸಿ” ಬಟನ್ ಒತ್ತಿ.",
    },
  },
  {
    icon: MonitorSmartphone,
    title: { en: "Fill the form with the helper", hi: "सहायक के साथ फ़ॉर्म भरिए", kn: "ಸಹಾಯಕನೊಂದಿಗೆ ಫಾರ್ಮ್ ತುಂಬಿರಿ" },
    text: {
      en: "Tap “Help Me Fill This Form”. The helper asks one question at a time. Answer by speaking. Say “I don't know” to leave a question for later.",
      hi: "“यह फ़ॉर्म भरने में मदद करें” दबाइए। सहायक एक बार में एक सवाल पूछेगा। बोलकर जवाब दीजिए। किसी सवाल को बाद के लिए छोड़ने को “मुझे नहीं पता” कहिए।",
      kn: "“ಈ ಫಾರ್ಮ್ ತುಂಬಲು ಸಹಾಯ ಮಾಡಿ” ಒತ್ತಿ. ಸಹಾಯಕ ಒಂದು ಬಾರಿಗೆ ಒಂದು ಪ್ರಶ್ನೆ ಕೇಳುತ್ತದೆ. ಮಾತಿನಲ್ಲಿ ಉತ್ತರಿಸಿ. ಪ್ರಶ್ನೆಯನ್ನು ನಂತರಕ್ಕೆ ಬಿಡಲು “ನನಗೆ ಗೊತ್ತಿಲ್ಲ” ಎನ್ನಿ.",
    },
  },
  {
    icon: Hand,
    title: { en: "Say “yes” to fill each answer", hi: "हर जवाब भरने के लिए “हाँ” कहिए", kn: "ಪ್ರತಿ ಉತ್ತರ ತುಂಬಲು “ಹೌದು” ಎನ್ನಿ" },
    text: {
      en: "The helper shows what it will write. Say “yes” or tap “Fill field” to put it in the form. Tap “Don't fill” if it is wrong.",
      hi: "सहायक दिखाता है कि वह क्या लिखेगा। फ़ॉर्म में डालने के लिए “हाँ” कहिए या “भरें” दबाइए। गलत हो तो “न भरें” दबाइए।",
      kn: "ಸಹಾಯಕ ತಾನು ಏನು ಬರೆಯುತ್ತದೆ ಎಂದು ತೋರಿಸುತ್ತದೆ. ಫಾರ್ಮ್‌ಗೆ ಹಾಕಲು “ಹೌದು” ಎನ್ನಿ ಅಥವಾ “ತುಂಬಿ” ಒತ್ತಿ. ತಪ್ಪಾಗಿದ್ದರೆ “ತುಂಬಬೇಡಿ” ಒತ್ತಿ.",
    },
  },
  {
    icon: ClipboardCheck,
    title: { en: "Check everything and submit", hi: "सब कुछ जाँचिए और भेजिए", kn: "ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸಿ ಕಳುಹಿಸಿ" },
    text: {
      en: "When the bar reaches 100%, tap “Review”. Read every answer. Tick the declaration box yourself, then submit.",
      hi: "जब पट्टी 100% हो जाए, “समीक्षा” दबाइए। हर जवाब पढ़िए। घोषणा वाला बॉक्स खुद टिक कीजिए, फिर भेजिए।",
      kn: "ಪಟ್ಟಿ 100% ತಲುಪಿದಾಗ “ಪರಿಶೀಲನೆ” ಒತ್ತಿ. ಪ್ರತಿ ಉತ್ತರ ಓದಿ. ಘೋಷಣೆಯ ಪೆಟ್ಟಿಗೆಯನ್ನು ನೀವೇ ಟಿಕ್ ಮಾಡಿ, ನಂತರ ಕಳುಹಿಸಿ.",
    },
  },
  {
    icon: ListChecks,
    title: { en: "Track your application", hi: "अपना आवेदन देखते रहिए", kn: "ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಗಮನಿಸಿ" },
    text: {
      en: "Open “Applications” to see every application, how far it has gone and what to do next. You can stop at any time and continue later.",
      hi: "“आवेदन” खोलिए — हर आवेदन, वह कहाँ तक पहुँचा और आगे क्या करना है, दिखेगा। आप कभी भी रुककर बाद में जारी रख सकते हैं।",
      kn: "“ಅರ್ಜಿಗಳು” ತೆರೆಯಿರಿ — ಪ್ರತಿ ಅರ್ಜಿ, ಅದು ಎಲ್ಲಿಯವರೆಗೆ ಹೋಗಿದೆ ಮತ್ತು ಮುಂದೆ ಏನು ಮಾಡಬೇಕು ಎಂದು ಕಾಣುತ್ತದೆ. ಯಾವಾಗ ಬೇಕಾದರೂ ನಿಲ್ಲಿಸಿ ನಂತರ ಮುಂದುವರಿಸಬಹುದು.",
    },
  },
];

const NEED: { icon: typeof Mic; text: Tri }[] = [
  { icon: Smartphone, text: { en: "A phone or computer with internet", hi: "इंटरनेट वाला फ़ोन या कंप्यूटर", kn: "ಇಂಟರ್ನೆಟ್ ಇರುವ ಫೋನ್ ಅಥವಾ ಕಂಪ್ಯೂಟರ್" } },
  { icon: FileText, text: { en: "Aadhaar card or driving licence", hi: "आधार कार्ड या ड्राइविंग लाइसेंस", kn: "ಆಧಾರ್ ಕಾರ್ಡ್ ಅಥವಾ ಡ್ರೈವಿಂಗ್ ಲೈಸೆನ್ಸ್" } },
  { icon: FileText, text: { en: "Land record (RTC / Pahani)", hi: "ज़मीन का रिकॉर्ड (RTC / पहाणी)", kn: "ಜಮೀನಿನ ದಾಖಲೆ (RTC / ಪಹಣಿ)" } },
  { icon: FileText, text: { en: "Bank passbook (first page)", hi: "बैंक पासबुक (पहला पन्ना)", kn: "ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ (ಮೊದಲ ಪುಟ)" } },
];

const WORDS: { word: Tri; meaning: Tri }[] = [
  { word: { en: "Scheme", hi: "योजना", kn: "ಯೋಜನೆ" }, meaning: { en: "A government programme that gives money or help.", hi: "सरकार का कार्यक्रम जो पैसा या मदद देता है।", kn: "ಹಣ ಅಥವಾ ಸಹಾಯ ನೀಡುವ ಸರ್ಕಾರಿ ಕಾರ್ಯಕ್ರಮ." } },
  { word: { en: "Application", hi: "आवेदन", kn: "ಅರ್ಜಿ" }, meaning: { en: "Your request to get help from a scheme.", hi: "किसी योजना से मदद पाने का आपका अनुरोध।", kn: "ಯೋಜನೆಯಿಂದ ಸಹಾಯ ಪಡೆಯಲು ನಿಮ್ಮ ವಿನಂತಿ." } },
  { word: { en: "Source", hi: "स्रोत", kn: "ಮೂಲ" }, meaning: { en: "The official paper an answer came from.", hi: "वह आधिकारिक कागज़ जिससे जवाब आया।", kn: "ಉತ್ತರ ಬಂದ ಅಧಿಕೃತ ದಾಖಲೆ." } },
  { word: { en: "RTC / Pahani", hi: "RTC / पहाणी", kn: "RTC / ಪಹಣಿ" }, meaning: { en: "Your land record. It has your survey number.", hi: "आपकी ज़मीन का रिकॉर्ड। इसमें सर्वे नंबर होता है।", kn: "ನಿಮ್ಮ ಜಮೀನಿನ ದಾಖಲೆ. ಇದರಲ್ಲಿ ಸರ್ವೆ ಸಂಖ್ಯೆ ಇರುತ್ತದೆ." } },
  { word: { en: "IFSC", hi: "IFSC", kn: "IFSC" }, meaning: { en: "An 11-letter bank branch code, printed on your passbook.", hi: "बैंक शाखा का 11 अक्षर का कोड, जो पासबुक पर छपा होता है।", kn: "ಬ್ಯಾಂಕ್ ಶಾಖೆಯ 11 ಅಕ್ಷರದ ಕೋಡ್, ನಿಮ್ಮ ಪಾಸ್‌ಬುಕ್‌ನಲ್ಲಿ ಮುದ್ರಿತವಾಗಿರುತ್ತದೆ." } },
  { word: { en: "OTP", hi: "OTP", kn: "OTP" }, meaning: { en: "A secret number sent by SMS. Never tell it to anyone, not even Sahayak.", hi: "SMS से आने वाला गुप्त नंबर। इसे कभी किसी को न बताएँ, सहायक को भी नहीं।", kn: "SMS ಮೂಲಕ ಬರುವ ರಹಸ್ಯ ಸಂಖ್ಯೆ. ಇದನ್ನು ಯಾರಿಗೂ ಹೇಳಬೇಡಿ, ಸಹಾಯಕನಿಗೂ ಸಹ." } },
];

function ListenButton({ id, text, playing, setPlaying }: { id: string; text: string; playing: string | null; setPlaying: (v: string | null) => void }) {
  const { lang } = useI18n();
  const tr = useTr();
  const on = playing === id;
  return (
    <button
      className={`btn-sm btn ${on ? "bg-saffron text-white" : "border border-ink-200 bg-white text-ink-800 hover:bg-ink-50"}`}
      onClick={() => {
        stopSpeaking();
        if (on) return setPlaying(null);
        setPlaying(id);
        speak(text, lang, () => setPlaying(null));
      }}
      aria-pressed={on}
    >
      {on ? <Square size={14} /> : <Volume2 size={16} />}
      {on ? tr({ en: "Stop", hi: "रोकें", kn: "ನಿಲ್ಲಿಸಿ" }) : tr({ en: "Listen", hi: "सुनें", kn: "ಕೇಳಿ" })}
    </button>
  );
}

export default function Guide() {
  const tr = useTr();
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => stopSpeaking(), []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50 text-saffron-700"><CircleHelp size={28} /></span>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{tr({ en: "How to use Sahayak", hi: "सहायक का इस्तेमाल कैसे करें", kn: "ಸಹಾಯಕ ಬಳಸುವುದು ಹೇಗೆ" })}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-ink-600">
          {tr({
            en: "Follow these steps one by one. Tap “Listen” on any step to hear it read aloud.",
            hi: "ये कदम एक-एक करके अपनाइए। किसी भी कदम को सुनने के लिए “सुनें” दबाइए।",
            kn: "ಈ ಹಂತಗಳನ್ನು ಒಂದೊಂದಾಗಿ ಅನುಸರಿಸಿ. ಯಾವುದೇ ಹಂತವನ್ನು ಕೇಳಲು “ಕೇಳಿ” ಒತ್ತಿ.",
          })}
        </p>
      </div>

      {/* What you need */}
      <section className="card mt-10 p-5 sm:p-6" aria-labelledby="need">
        <h2 id="need" className="section-title">{tr({ en: "Keep these ready", hi: "ये चीज़ें पास रखिए", kn: "ಇವುಗಳನ್ನು ಸಿದ್ಧವಾಗಿಡಿ" })}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {NEED.map(({ icon: Icon, text }) => (
            <li key={text.en} className="flex items-center gap-3 rounded-xl bg-paper-100 px-4 py-3 font-semibold text-ink-800">
              <Icon size={22} className="flex-none text-saffron-600" /> {tr(text)}
            </li>
          ))}
        </ul>
      </section>

      {/* Steps */}
      <ol className="mt-10 space-y-4">
        {STEPS.map(({ icon: Icon, title, text, tip }, i) => (
          <li key={title.en} className="card flex gap-4 p-5 sm:gap-5 sm:p-6">
            <div className="flex flex-none flex-col items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-800 text-lg font-bold text-white" aria-hidden>{i + 1}</span>
              <span className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-saffron-50 text-saffron-700 sm:flex"><Icon size={24} /></span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-ink-900"><span className="sr-only">{i + 1}. </span>{tr(title)}</h2>
              <p className="mt-2 text-[1.05rem] leading-relaxed text-ink-700">{tr(text)}</p>
              {tip && <p className="mt-3 rounded-xl bg-paper-100 px-4 py-2.5 text-ink-700">💬 {tr(tip)}</p>}
              <div className="mt-4">
                <ListenButton id={title.en} text={`${tr(title)}. ${tr(text)}${tip ? " " + tr(tip) : ""}`} playing={playing} setPlaying={setPlaying} />
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Safety */}
      <section className="mt-10 flex gap-4 rounded-2xl border border-brick-100 bg-brick-50 p-5 sm:p-6">
        <ShieldAlert size={28} className="flex-none text-brick" />
        <div>
          <h2 className="text-lg font-bold text-brick">{tr({ en: "Stay safe", hi: "सुरक्षित रहिए", kn: "ಸುರಕ್ಷಿತವಾಗಿರಿ" })}</h2>
          <ul className="mt-2 space-y-1.5 text-ink-800">
            <li>• {tr({ en: "Never say or type an OTP, PIN or password. Sahayak will never ask for one.", hi: "OTP, PIN या पासवर्ड कभी न बोलें या लिखें। सहायक कभी नहीं माँगेगा।", kn: "OTP, PIN ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಎಂದಿಗೂ ಹೇಳಬೇಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಬೇಡಿ. ಸಹಾಯಕ ಎಂದಿಗೂ ಕೇಳುವುದಿಲ್ಲ." })}</li>
            <li>• {tr({ en: "Always read the answer before saying “yes”.", hi: "“हाँ” कहने से पहले हमेशा जवाब पढ़िए।", kn: "“ಹೌದು” ಎನ್ನುವ ಮೊದಲು ಯಾವಾಗಲೂ ಉತ್ತರ ಓದಿ." })}</li>
            <li>• {tr({ en: "This is a practice version. Confirm rules on the official government website.", hi: "यह अभ्यास संस्करण है। नियम सरकारी वेबसाइट पर ज़रूर जाँचें।", kn: "ಇದು ಅಭ್ಯಾಸ ಆವೃತ್ತಿ. ನಿಯಮಗಳನ್ನು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಖಚಿತಪಡಿಸಿ." })}</li>
          </ul>
        </div>
      </section>

      {/* Words */}
      <section className="mt-10" aria-labelledby="words">
        <h2 id="words" className="font-display text-2xl font-bold">{tr({ en: "Words you may see", hi: "शब्द जो आपको दिख सकते हैं", kn: "ನೀವು ನೋಡಬಹುದಾದ ಪದಗಳು" })}</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {WORDS.map(({ word, meaning }) => (
            <div key={word.en} className="card p-4">
              <dt className="font-bold text-ink-900">{tr(word)}</dt>
              <dd className="mt-1 text-ink-600">{tr(meaning)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-semibold text-ink-800">{tr({ en: "Ready? Let's begin.", hi: "तैयार हैं? चलिए शुरू करें।", kn: "ಸಿದ್ಧರಿದ್ದೀರಾ? ಪ್ರಾರಂಭಿಸೋಣ." })}</p>
        <Link to="/assistant" className="btn-accent btn-lg"><Mic size={20} /> {tr({ en: "Talk to the assistant", hi: "सहायक से बात करें", kn: "ಸಹಾಯಕರೊಂದಿಗೆ ಮಾತನಾಡಿ" })} <ArrowRight size={20} /></Link>
      </div>
    </div>
  );
}
