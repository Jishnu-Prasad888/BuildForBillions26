import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Bot, CircleHelp, EyeOff, FileCheck2, Hand, Landmark, Mic, MonitorSmartphone, Search, ShieldCheck } from "lucide-react";
import { LANGUAGES, useI18n, useTr } from "@/i18n";

export default function Landing() {
  const { lang, setLang } = useI18n();
  const tr = useTr();

  const steps = [
    {
      icon: Mic,
      title: tr({ en: "Tell us what happened", hi: "बताइए क्या हुआ", kn: "ಏನಾಯಿತು ಎಂದು ಹೇಳಿ" }),
      text: tr({
        en: "Press the microphone and speak, or type. For example: “Heavy rain destroyed my crop.”",
        hi: "माइक दबाकर बोलिए, या लिखिए। जैसे: “भारी बारिश से मेरी फसल बर्बाद हो गई।”",
        kn: "ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ, ಅಥವಾ ಟೈಪ್ ಮಾಡಿ. ಉದಾಹರಣೆ: “ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ಹಾಳಾಯಿತು.”",
      }),
    },
    {
      icon: Search,
      title: tr({ en: "See the help you can get", hi: "देखिए आपको कौन सी मदद मिल सकती है", kn: "ನಿಮಗೆ ಸಿಗುವ ಸಹಾಯ ನೋಡಿ" }),
      text: tr({
        en: "Sahayak finds government schemes for you, tells you who can apply and which papers you need.",
        hi: "सहायक आपके लिए सरकारी योजनाएँ खोजता है, बताता है कौन आवेदन कर सकता है और कौन से कागज़ चाहिए।",
        kn: "ಸಹಾಯಕ ನಿಮಗಾಗಿ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕುತ್ತದೆ, ಯಾರು ಅರ್ಜಿ ಹಾಕಬಹುದು ಮತ್ತು ಯಾವ ದಾಖಲೆಗಳು ಬೇಕು ಎಂದು ಹೇಳುತ್ತದೆ.",
      }),
    },
    {
      icon: MonitorSmartphone,
      title: tr({ en: "Fill the form together", hi: "साथ मिलकर फ़ॉर्म भरिए", kn: "ಒಟ್ಟಿಗೆ ಫಾರ್ಮ್ ತುಂಬಿರಿ" }),
      text: tr({
        en: "Sahayak asks one simple question at a time and fills the answer only after you say yes.",
        hi: "सहायक एक-एक करके आसान सवाल पूछता है और आपके “हाँ” कहने के बाद ही जवाब भरता है।",
        kn: "ಸಹಾಯಕ ಒಂದೊಂದೇ ಸುಲಭ ಪ್ರಶ್ನೆ ಕೇಳುತ್ತದೆ ಮತ್ತು ನೀವು “ಹೌದು” ಎಂದ ನಂತರವೇ ಉತ್ತರ ತುಂಬುತ್ತದೆ.",
      }),
    },
  ];

  const trust = [
    {
      icon: BadgeCheck,
      title: tr({ en: "Every answer shows its source", hi: "हर जवाब का स्रोत दिखता है", kn: "ಪ್ರತಿ ಉತ್ತರದ ಮೂಲ ಕಾಣುತ್ತದೆ" }),
      text: tr({ en: "Tap a number next to an answer to see the official document it came from.", hi: "जवाब के पास वाले नंबर पर दबाइए — वह आधिकारिक दस्तावेज़ दिखेगा जिससे जवाब आया।", kn: "ಉತ್ತರದ ಪಕ್ಕದ ಸಂಖ್ಯೆಯನ್ನು ಒತ್ತಿ — ಅದು ಬಂದ ಅಧಿಕೃತ ದಾಖಲೆ ಕಾಣುತ್ತದೆ." }),
    },
    {
      icon: Hand,
      title: tr({ en: "Nothing is filled without your “yes”", hi: "आपकी “हाँ” के बिना कुछ नहीं भरा जाता", kn: "ನಿಮ್ಮ “ಹೌದು” ಇಲ್ಲದೆ ಏನೂ ತುಂಬುವುದಿಲ್ಲ" }),
      text: tr({ en: "You check every answer before it goes on the form, and you submit it yourself.", hi: "फ़ॉर्म में जाने से पहले आप हर जवाब देखते हैं, और आवेदन आप खुद भेजते हैं।", kn: "ಫಾರ್ಮ್‌ಗೆ ಹೋಗುವ ಮೊದಲು ನೀವು ಪ್ರತಿ ಉತ್ತರ ನೋಡುತ್ತೀರಿ, ಮತ್ತು ಅರ್ಜಿಯನ್ನು ನೀವೇ ಕಳುಹಿಸುತ್ತೀರಿ." }),
    },
    {
      icon: EyeOff,
      title: tr({ en: "Your numbers stay hidden", hi: "आपके नंबर छिपे रहते हैं", kn: "ನಿಮ್ಮ ಸಂಖ್ಯೆಗಳು ಮರೆಯಾಗಿರುತ್ತವೆ" }),
      text: tr({ en: "Aadhaar and bank numbers are shown as ••••1234. Never share an OTP or password.", hi: "आधार और बैंक नंबर ••••1234 जैसे दिखते हैं। OTP या पासवर्ड कभी न बताएँ।", kn: "ಆಧಾರ್ ಮತ್ತು ಬ್ಯಾಂಕ್ ಸಂಖ್ಯೆಗಳು ••••1234 ಹಾಗೆ ಕಾಣುತ್ತವೆ. OTP ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಎಂದಿಗೂ ಹೇಳಬೇಡಿ." }),
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <svg className="pointer-events-none absolute -right-32 -top-32 opacity-10" width="520" height="520" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="46" stroke="#fff" strokeWidth="1.2" fill="none" />
          {Array.from({ length: 24 }).map((_, i) => (
            <line key={i} x1="50" y1="50" x2={50 + 46 * Math.cos((i * Math.PI) / 12)} y2={50 + 46 * Math.sin((i * Math.PI) / 12)} stroke="#fff" strokeWidth="0.6" />
          ))}
        </svg>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div>
            <h1 className="font-display text-[2.1rem] font-bold leading-[1.15] text-white sm:text-5xl">
              {tr({ en: "Government help, in your own language.", hi: "सरकारी मदद, आपकी अपनी भाषा में।", kn: "ಸರ್ಕಾರಿ ಸಹಾಯ, ನಿಮ್ಮದೇ ಭಾಷೆಯಲ್ಲಿ." })}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink-200 sm:text-xl">
              {tr({
                en: "Speak about your problem. Sahayak finds the schemes that can help you and fills the form with you, step by step.",
                hi: "अपनी समस्या बोलकर बताइए। सहायक आपकी मदद करने वाली योजनाएँ खोजता है और कदम-दर-कदम आपके साथ फ़ॉर्म भरता है।",
                kn: "ನಿಮ್ಮ ಸಮಸ್ಯೆಯನ್ನು ಮಾತಿನಲ್ಲಿ ಹೇಳಿ. ಸಹಾಯಕ ನಿಮಗೆ ಸಹಾಯ ಮಾಡುವ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕುತ್ತದೆ ಮತ್ತು ಹಂತ ಹಂತವಾಗಿ ನಿಮ್ಮೊಂದಿಗೆ ಫಾರ್ಮ್ ತುಂಬುತ್ತದೆ.",
              })}
            </p>

            <div className="mt-7">
              <div className="mb-2 text-sm font-semibold text-ink-300">{tr({ en: "Choose your language", hi: "अपनी भाषा चुनिए", kn: "ನಿಮ್ಮ ಭಾಷೆ ಆರಿಸಿ" })}</div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Language">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    role="radio"
                    aria-checked={lang === l.code}
                    onClick={() => setLang(l.code)}
                    className={`min-h-[48px] min-w-[104px] rounded-xl border-2 px-4 text-lg font-semibold transition-colors ${lang === l.code ? "border-saffron bg-saffron text-white" : "border-ink-600 text-ink-100 hover:border-ink-300"}`}
                  >
                    {l.native}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup" className="btn-accent btn-lg">
                {tr({ en: "Start now — it's free", hi: "अभी शुरू करें — मुफ़्त है", kn: "ಈಗಲೇ ಪ್ರಾರಂಭಿಸಿ — ಉಚಿತ" })} <ArrowRight size={20} />
              </Link>
              <Link to="/signin" className="btn-lg btn border-2 border-ink-600 text-white hover:border-ink-300">
                {tr({ en: "I already have an account", hi: "मेरा खाता पहले से है", kn: "ನನಗೆ ಈಗಾಗಲೇ ಖಾತೆ ಇದೆ" })}
              </Link>
            </div>
            <Link to="/guide" className="mt-5 inline-flex items-center gap-2 font-semibold text-saffron-100 hover:text-white">
              <CircleHelp size={18} /> {tr({ en: "New here? See how it works with pictures", hi: "पहली बार? चित्रों के साथ देखें यह कैसे काम करता है", kn: "ಮೊದಲ ಬಾರಿಗೆ? ಚಿತ್ರಗಳ ಜೊತೆ ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ ನೋಡಿ" })}
            </Link>
          </div>

          {/* A static preview of a conversation, so people see what they will get before signing up. */}
          <div className="rounded-3xl bg-white p-4 text-ink-800 shadow-lift sm:p-5" aria-hidden>
            <div className="flex justify-end">
              <div className="flex max-w-[85%] items-start gap-2 rounded-2xl rounded-tr-sm bg-ink-800 px-4 py-3 text-white">
                <Mic size={16} className="mt-1 flex-none text-saffron" />
                {tr({ en: "Heavy rain destroyed my crop. What help can I get?", hi: "भारी बारिश से मेरी फसल बर्बाद हो गई। मुझे क्या मदद मिल सकती है?", kn: "ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ಹಾಳಾಯಿತು. ನನಗೆ ಯಾವ ಸಹಾಯ ಸಿಗಬಹುದು?" })}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink-800 text-white"><Bot size={16} /></div>
              <div className="rounded-2xl rounded-tl-sm bg-paper-100 px-4 py-3 text-[0.95rem]">
                {tr({ en: "You may get crop loss relief", hi: "आपको फसल नुकसान राहत मिल सकती है", kn: "ನಿಮಗೆ ಬೆಳೆ ನಷ್ಟ ಪರಿಹಾರ ಸಿಗಬಹುದು" })}
                <span className="cite">1</span>.{" "}
                {tr({ en: "Report the damage within 72 hours for crop insurance", hi: "फसल बीमा के लिए 72 घंटों में नुकसान की सूचना दें", kn: "ಬೆಳೆ ವಿಮೆಗಾಗಿ 72 ಗಂಟೆಗಳಲ್ಲಿ ಹಾನಿಯನ್ನು ತಿಳಿಸಿ" })}
                <span className="cite">2</span>.
              </div>
            </div>
            <div className="ml-10 mt-3 rounded-2xl border border-paper-300 p-3">
              <div className="font-semibold text-ink-900">{tr({ en: "Crop Loss Input Subsidy", hi: "फसल नुकसान इनपुट सब्सिडी", kn: "ಬೆಳೆ ನಷ್ಟ ಇನ್‌ಪುಟ್ ಸಬ್ಸಿಡಿ" })}</div>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-leaf-50 px-2.5 py-1.5 text-sm text-leaf-700">
                <Landmark size={14} /> {tr({ en: "Money per hectare of damaged crop", hi: "नुकसान वाली फसल के हर हेक्टेयर पर पैसा", kn: "ಹಾಳಾದ ಪ್ರತಿ ಹೆಕ್ಟೇರ್ ಬೆಳೆಗೆ ಹಣ" })}
              </div>
              <div className="mt-3 flex gap-2">
                <span className="btn-accent btn-sm">{tr({ en: "Apply", hi: "आवेदन करें", kn: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ" })} <ArrowRight size={14} /></span>
                <span className="btn-secondary btn-sm"><FileCheck2 size={14} /> {tr({ en: "Papers needed", hi: "ज़रूरी कागज़", kn: "ಬೇಕಾದ ದಾಖಲೆಗಳು" })}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">{tr({ en: "How it works", hi: "यह कैसे काम करता है", kn: "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ" })}</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-lg text-ink-600">{tr({ en: "Three simple steps. You can speak at every step.", hi: "तीन आसान कदम। हर कदम पर आप बोल सकते हैं।", kn: "ಮೂರು ಸುಲಭ ಹಂತಗಳು. ಪ್ರತಿ ಹಂತದಲ್ಲೂ ನೀವು ಮಾತನಾಡಬಹುದು." })}</p>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={i} className="card relative flex flex-col p-6">
              <span className="absolute right-5 top-4 font-display text-5xl font-bold text-paper-300" aria-hidden>{i + 1}</span>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50 text-saffron-700"><Icon size={28} /></span>
              <h3 className="mt-5 text-xl font-bold">
                <span className="sr-only">{i + 1}. </span>{title}
              </h3>
              <p className="mt-2 text-ink-600">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section className="border-y border-paper-300 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex items-center justify-center gap-2 text-leaf-700"><ShieldCheck size={22} /><span className="eyebrow text-leaf-700">{tr({ en: "Safe and honest", hi: "सुरक्षित और सच्चा", kn: "ಸುರಕ್ಷಿತ ಮತ್ತು ಪ್ರಾಮಾಣಿಕ" })}</span></div>
          <h2 className="mt-2 text-center font-display text-3xl font-bold sm:text-4xl">{tr({ en: "You stay in control", hi: "फ़ैसला हमेशा आपका", kn: "ನಿರ್ಧಾರ ಯಾವಾಗಲೂ ನಿಮ್ಮದು" })}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {trust.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 rounded-2xl bg-paper-100 p-5">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-leaf-50 text-leaf-700"><Icon size={24} /></span>
                <div>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="mt-1 text-ink-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="card flex flex-col items-start gap-6 p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">{tr({ en: "Want to try it first?", hi: "पहले आज़माना चाहते हैं?", kn: "ಮೊದಲು ಪ್ರಯತ್ನಿಸಲು ಬಯಸುವಿರಾ?" })}</h2>
            <p className="mt-2 max-w-xl text-lg text-ink-600">
              {tr({
                en: "Sign in with the practice account of Ramesh, a farmer. Nothing you do is sent to the government.",
                hi: "किसान रमेश के अभ्यास खाते से साइन इन करें। आप जो भी करेंगे वह सरकार को नहीं भेजा जाएगा।",
                kn: "ರೈತ ರಮೇಶ್ ಅವರ ಅಭ್ಯಾಸ ಖಾತೆಯಿಂದ ಸೈನ್ ಇನ್ ಮಾಡಿ. ನೀವು ಮಾಡುವ ಯಾವುದೂ ಸರ್ಕಾರಕ್ಕೆ ಹೋಗುವುದಿಲ್ಲ.",
              })}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to="/signin?demo=citizen" className="btn-primary btn-lg">{tr({ en: "Try the demo", hi: "डेमो आज़माएँ", kn: "ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ" })} <ArrowRight size={20} /></Link>
            <Link to="/guide" className="btn-secondary btn-lg"><CircleHelp size={20} /> {tr({ en: "Read the guide", hi: "गाइड पढ़ें", kn: "ಮಾರ್ಗದರ್ಶಿ ಓದಿ" })}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
