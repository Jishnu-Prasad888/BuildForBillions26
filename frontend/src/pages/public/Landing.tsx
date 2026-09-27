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
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid items-center gap-10 py-12 sm:py-16 lg:min-h-[560px] lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            {/* Left */}
            <div className="max-w-xl">
              <h1 className="text-4xl font-medium leading-[1.12] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
                {tr({ en: "Government help, in your language.", hi: "सरकारी मदद, आपकी भाषा में।", kn: "ಸರ್ಕಾರಿ ಸಹಾಯ, ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ." })}
              </h1>

              <p className="mt-5 max-w-[560px] text-lg leading-relaxed text-ink-600">
                {tr({
                  en: "Speak about your problem. Sahayak finds government schemes for you.",
                  hi: "अपनी समस्या बोलकर बताइए। सहायक आपके लिए सरकारी योजनाएँ खोजता है।",
                  kn: "ನಿಮ್ಮ ಸಮಸ್ಯೆ ಹೇಳಿ. ಸಹಾಯಕ ನಿಮಗಾಗಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕುತ್ತದೆ.",
                })}
              </p>

              <div className="mt-7">
                <div className="eyebrow mb-2">
                  {tr({ en: "Choose language", hi: "भाषा चुनिए", kn: "ಭಾಷೆ ಆರಿಸಿ" })}
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Language">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      role="radio"
                      aria-checked={lang === l.code}
                      onClick={() => setLang(l.code)}
                      className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition-colors ${
                        lang === l.code ? "bg-forest-100 text-forest-800" : "border border-paper-300 text-ink-700 hover:bg-ink-50"
                      }`}
                    >
                      {l.native}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className="btn-primary btn-lg group">
                  {tr({ en: "Start now", hi: "अभी शुरू करें", kn: "ಈಗಲೇ ಪ್ರಾರಂಭಿಸಿ" })}
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to="/signin" className="btn-secondary btn-lg">
                  {tr({ en: "Sign in", hi: "साइन इन करें", kn: "ಸೈನ್ ಇನ್ ಮಾಡಿ" })}
                </Link>
              </div>
            </div>

            {/* Right — assistant preview */}
            <div className="w-full max-w-md justify-self-center lg:justify-self-end">
              <div className="overflow-hidden rounded-xl border border-paper-300 bg-white shadow-card" aria-hidden>
                <div className="flex items-center gap-3 border-b border-paper-300 px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink-900">Sahayak</div>
                    <div className="text-xs text-ink-500">Public Service Assistant</div>
                  </div>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-leaf" />
                    {tr({ en: "Listening", hi: "सुन रहा है", kn: "ಕೇಳುತ್ತಿದೆ" })}
                  </span>
                </div>

                <div className="space-y-3 bg-paper-100 p-4">
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-forest-600 px-3 py-2 text-[13px] leading-5 text-white">
                      {tr({
                        en: "Heavy rain destroyed my crop. What help can I get?",
                        hi: "भारी बारिश से मेरी फसल बर्बाद हो गई। मुझे क्या मदद मिल सकती है?",
                        kn: "ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ಹಾಳಾಯಿತು. ನನಗೆ ಯಾವ ಸಹಾಯ ಸಿಗಬಹುದು?",
                      })}
                    </div>
                  </div>

                  <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-paper-300 bg-white px-3 py-2 text-[13px] leading-relaxed text-ink-800">
                    {tr({ en: "You may get crop loss relief", hi: "आपको फसल नुकसान राहत मिल सकती है", kn: "ನಿಮಗೆ ಬೆಳೆ ನಷ್ಟ ಪರಿಹಾರ ಸಿಗಬಹುದು" })}
                    <span className="cite">1</span>.
                  </div>

                  <div className="rounded-xl border border-paper-300 bg-white p-3.5">
                    <div className="text-[13px] font-medium text-ink-900">
                      {tr({ en: "Crop Loss Input Subsidy", hi: "फसल नुकसान इनपुट सब्सिडी", kn: "ಬೆಳೆ ನಷ್ಟ ಇన్‌ಪುಟ್ ಸಬ್ಸిడಿ" })}
                    </div>
                    <div className="mt-1 text-xs text-ink-600">
                      {tr({ en: "Money per hectare of damaged crop", hi: "नुकसान वाली फसल के हर हेक्टेयर पर पैसा", kn: "ಹಾಳಾದ ಪ್ರತಿ ಹೆಕ್ಟೇರ್ ಬೆಳೆಗೆ ಹಣ" })}
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-3 py-1.5 text-xs font-medium text-white">
                        {tr({ en: "Apply", hi: "आवेदन करें", kn: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ" })}
                        <ArrowRight size={12} />
                      </span>
                      <span className="inline-flex items-center rounded-full border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700">
                        {tr({ en: "Papers needed", hi: "ज़रूरी कागज़", kn: "ಬೇಕಾದ ದಾಖಲೆಗಳು" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-paper-300 bg-white p-3">
                  <div className="flex items-center gap-2 rounded-full border border-paper-300 bg-paper-100 px-4 py-2">
                    <span className="flex-1 text-xs text-ink-400">
                      {tr({ en: "Tell us what happened...", hi: "बताइए क्या हुआ...", kn: "ಏನಾಯಿತು ಎಂದು ಹೇಳಿ..." })}
                    </span>
                    <span className="rounded-full bg-forest-600 px-3 py-1 text-xs font-medium text-white">
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
      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="mb-6 text-2xl font-medium tracking-tight text-ink-900 sm:text-3xl">{tr({ en: "Safe and secure", hi: "सुरक्षित और विश्वसनीय", kn: "ಸುರಕ್ಷಿತ ಮತ್ತು ವಿಶ್ವಾಸಾರ್ಹ" })}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {trust.map(({ title, text }) => (
              <div key={title} className="card p-5">
                <h3 className="font-medium text-ink-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-forest-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-medium tracking-tight text-white sm:text-3xl">{tr({ en: "Ready to get started?", hi: "शुरू करने के लिए तैयार हैं?", kn: "ಪ್ರಾರಂಭಿಸಲು ಸಿದ್ಧರಾ?" })}</h2>
            <p className="mt-1.5 text-forest-100">{tr({ en: "Sign in with a sample citizen account or create your own.", hi: "नमूना नागरिक खाते से साइन इन करें या अपना खाता बनाएँ।", kn: "ಮಾದರಿ ನಾಗರಿಕ ಖಾತೆಯಿಂದ ಸೈನ್ ಇನ್ ಮಾಡಿ ಅಥವಾ ನಿಮ್ಮದೇ ಖಾತೆ ರಚಿಸಿ." })}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/signin?demo=citizen" className="btn btn-lg border border-white/40 text-white hover:bg-white/10">
              {tr({ en: "Use sample account", hi: "नमूना खाता उपयोग करें", kn: "ಮಾದರಿ ಖಾತೆ ಬಳಸಿ" })}
            </Link>
            <Link to="/signup" className="btn btn-lg bg-white text-forest-800 hover:bg-forest-50">
              {tr({ en: "Create account", hi: "खाता बनाएँ", kn: "ಖಾತೆ ರಚಿಸಿ" })} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
