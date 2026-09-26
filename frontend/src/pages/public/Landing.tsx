import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LANGUAGES, useI18n, useTr } from "@/i18n";
import GuideSection from "@/components/GuideSection";

export default function Landing() {
  const { lang, setLang } = useI18n();
  const tr = useTr();
  const { hash } = useLocation();

  // Deep links like /welcome#guide should land on the section, also when arriving from another page.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [hash]);

  const trust = [
    {
      title: tr({ en: "Answers are sourced", hi: "हर जवाब का स्रोत दिखता है", kn: "ಪ್ರತಿ ಉತ್ತರದ ಮೂಲ ಕಾಣುತ್ತದೆ" }),
      text: tr({ en: "Every answer links to its official document.", hi: "हर जवाब अपने आधिकारिक दस्तावेज़ से जुड़ा है।", kn: "ಪ್ರತಿ ಉತ್ತರ ಅದರ ಅಧಿಕೃತ ದಾಖಲೆಗೆ ಲಿಂಕ್ ಆಗಿದೆ." }),
    },
    {
      title: tr({ en: "You approve everything", hi: "आपकी हाँ के बिना कुछ नहीं भरा जाता", kn: "ನಿಮ್ಮ ಅನುಮತಿ ಇಲ್ಲದೆ ಏನೂ ಬರೆಯಲ್ಲ" }),
      text: tr({ en: "Nothing is filled until you say yes.", hi: "आपकी हाँ के बिना कुछ नहीं भरा जाता।", kn: "ನೀವು ಹೌದು ಎನ್ನುವವರೆಗೆ ಏನೂ ತುಂಬುವುದಿಲ್ಲ." }),
    },
    {
      title: tr({ en: "Your data is secure", hi: "आपके नंबर छिपे रहते हैं", kn: "ನಿಮ್ಮ ಡೇಟಾ ಸುರಕ್ಷಿತ" }),
      text: tr({ en: "Aadhaar and bank numbers stay masked.", hi: "आधार और बैंक नंबर छिपे रहते हैं।", kn: "ಆಧಾರ್ ಮತ್ತು ಬ್ಯಾಂಕ್ ಸಂಖ್ಯೆಗಳು ಮರೆಯಾಗಿರುತ್ತವೆ." }),
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden text-white">
        <div className="pointer-events-none absolute left-[30%] top-[35%] h-[320px] w-[320px] rounded-full bg-forest-600/10 blur-3xl" />

        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid items-center gap-10 py-12 sm:py-16 lg:min-h-[560px] lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            {/* Left */}
            <div className="relative z-10 max-w-xl">
              <h1 className="font-display text-[1.95rem] font-bold leading-[1.15] tracking-[-0.02em] text-white sm:text-[2.5rem] lg:text-[2.9rem]">
                {tr({ en: "Government help, in your language.", hi: "सरकारी मदद, आपकी भाषा में।", kn: "ಸರ್ಕಾರಿ ಸಹಾಯ, ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ." })}
              </h1>
              <div className="mt-4 flex h-1 w-20 overflow-hidden rounded-full">
                <span className="flex-1 bg-[#d9731a]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-leaf" />
              </div>

              <p className="mt-5 max-w-[560px] text-base leading-7 text-forest-200">
                {tr({
                  en: "Speak about your problem. Sahayak finds government schemes for you.",
                  hi: "अपनी समस्या बोलकर बताइए। सहायक आपके लिए सरकारी योजनाएँ खोजता है।",
                  kn: "ನಿಮ್ಮ ಸಮಸ್ಯೆ ಹೇಳಿ. ಸಹಾಯಕ ನಿಮಗಾಗಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕುತ್ತದೆ.",
                })}
              </p>

              <div className="mt-6">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-forest-300">
                  {tr({ en: "Choose language", hi: "भाषा चुनिए", kn: "ಭಾಷೆ ಆರಿಸಿ" })}
                </div>
                <div className="inline-flex rounded-md border border-forest-700 bg-forest-900/80 p-1" role="radiogroup" aria-label="Language">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      role="radio"
                      aria-checked={lang === l.code}
                      onClick={() => setLang(l.code)}
                      className={`min-h-[38px] min-w-[82px] rounded px-3.5 text-[13px] font-semibold transition-colors ${
                        lang === l.code ? "bg-white text-forest-950" : "text-forest-200 hover:bg-forest-800 hover:text-white"
                      }`}
                    >
                      {l.native}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className="btn btn-lg group bg-forest-500 text-white shadow-lg hover:bg-forest-600">
                  {tr({ en: "Start now", hi: "अभी शुरू करें", kn: "ಈಗಲೇ ಪ್ರಾರಂಭಿಸಿ" })}
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to="/signin" className="btn btn-lg border border-forest-500 text-white hover:bg-white/10">
                  {tr({ en: "Sign in", hi: "साइन इन करें", kn: "ಸೈನ್ ಇನ್ ಮಾಡಿ" })}
                </Link>
              </div>
            </div>

            {/* Right — assistant preview */}
            <div className="relative z-10 w-full max-w-md justify-self-center lg:justify-self-end">
              <div className="overflow-hidden rounded-lg border border-forest-200 bg-white shadow-lift" aria-hidden>
                <div className="flex items-center gap-3 border-b border-paper-300 bg-forest-800 px-5 py-3">
                  <div>
                    <div className="text-sm font-bold text-white">Sahayak</div>
                    <div className="text-[11px] text-forest-200">Public Service Assistant</div>
                  </div>
                  <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-forest-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-forest-300" />
                    {tr({ en: "Listening", hi: "सुन रहा है", kn: "ಕೇಳುತ್ತಿದೆ" })}
                  </span>
                </div>

                <div className="space-y-3 bg-paper-100 p-4">
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-lg rounded-tr-sm bg-forest-700 px-3 py-2 text-[13px] leading-5 text-white">
                      {tr({
                        en: "Heavy rain destroyed my crop. What help can I get?",
                        hi: "भारी बारिश से मेरी फसल बर्बाद हो गई। मुझे क्या मदद मिल सकती है?",
                        kn: "ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ಹಾಳಾಯಿತು. ನನಗೆ ಯಾವ ಸಹಾಯ ಸಿಗಬಹುದು?",
                      })}
                    </div>
                  </div>

                  <div className="max-w-[88%] rounded-lg rounded-tl-sm border border-paper-300 bg-white px-3 py-2 text-[13px] font-medium leading-relaxed text-forest-800">
                    {tr({ en: "You may get crop loss relief", hi: "आपको फसल नुकसान राहत मिल सकती है", kn: "ನಿಮಗೆ ಬೆಳೆ ನಷ್ಟ ಪರಿಹಾರ ಸಿಗಬಹುದು" })}
                    <span className="cite">1</span>.
                  </div>

                  <div className="rounded-lg border border-paper-300 border-l-4 border-l-forest-600 bg-white p-3.5">
                    <div className="text-[13px] font-bold text-ink-900">
                      {tr({ en: "Crop Loss Input Subsidy", hi: "फसल नुकसान इनपुट सब्सिडी", kn: "ಬೆಳೆ ನಷ್ಟ ಇನ್‌ಪುಟ್ ಸಬ್ಸಿಡಿ" })}
                    </div>
                    <div className="mt-1 text-xs text-forest-700">
                      {tr({ en: "Money per hectare of damaged crop", hi: "नुकसान वाली फसल के हर हेक्टेयर पर पैसा", kn: "ಹಾಳಾದ ಪ್ರತಿ ಹೆಕ್ಟೇರ್ ಬೆಳೆಗೆ ಹಣ" })}
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-forest-800 px-2.5 py-1.5 text-xs font-semibold text-white">
                        {tr({ en: "Apply", hi: "आवेदन करें", kn: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ" })}
                        <ArrowRight size={12} />
                      </span>
                      <span className="inline-flex items-center rounded border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700">
                        {tr({ en: "Papers needed", hi: "ज़रूरी कागज़", kn: "ಬೇಕಾದ ದಾಖಲೆಗಳು" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-paper-300 bg-white p-3">
                  <div className="flex items-center gap-2 rounded-md border border-paper-300 bg-paper-100 px-3 py-2">
                    <span className="flex-1 text-xs text-ink-400">
                      {tr({ en: "Tell us what happened...", hi: "बताइए क्या हुआ...", kn: "ಏನಾಯಿತು ಎಂದು ಹೇಳಿ..." })}
                    </span>
                    <span className="rounded bg-forest-700 px-2.5 py-1 text-xs font-semibold text-white">
                      {tr({ en: "Speak", hi: "बोलें", kn: "ಮಾತನಾಡಿ" })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* User guide (formerly its own page) */}
      <GuideSection />

      {/* Trust */}
      <section className="border-y border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="mb-6 font-display text-xl font-bold text-white sm:text-2xl">{tr({ en: "Safe and secure", hi: "सुरक्षित और विश्वसनीय", kn: "ಸುರಕ್ಷಿತ ಮತ್ತು ವಿಶ್ವಾಸಾರ್ಹ" })}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {trust.map(({ title, text }) => (
              <div key={title} className="rounded-lg border border-forest-100 border-t-4 border-t-forest-600 bg-white p-5 shadow-card">
                <h3 className="font-bold text-ink-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-6 rounded-lg border border-forest-200 bg-white px-6 py-8 shadow-card sm:px-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-forest-900 sm:text-2xl">{tr({ en: "Ready to get started?", hi: "शुरू करने के लिए तैयार हैं?", kn: "ಪ್ರಾರಂಭಿಸಲು ಸಿದ್ಧರಾ?" })}</h2>
            <p className="mt-1.5 text-ink-600">{tr({ en: "Sign in with a sample citizen account or create your own.", hi: "नमूना नागरिक खाते से साइन इन करें या अपना खाता बनाएँ।", kn: "ಮಾದರಿ ನಾಗರಿಕ ಖಾತೆಯಿಂದ ಸೈನ್ ಇನ್ ಮಾಡಿ ಅಥವಾ ನಿಮ್ಮದೇ ಖಾತೆ ರಚಿಸಿ." })}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/signin?demo=citizen" className="btn-secondary btn-lg border-forest-300 text-forest-800 hover:bg-forest-50">
              {tr({ en: "Use sample account", hi: "नमूना खाता उपयोग करें", kn: "ಮಾದರಿ ಖಾತೆ ಬಳಸಿ" })}
            </Link>
            <Link to="/signup" className="btn-primary btn-lg">
              {tr({ en: "Create account", hi: "खाता बनाएँ", kn: "ಖಾತೆ ರಚಿಸಿ" })} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
