import { Link } from "react-router-dom";
import { LANGUAGES, useI18n, useTr } from "@/i18n";
import Wheel from "@/components/Wheel";

import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  FileCheck2,
  Hand,
  Landmark,
  LockKeyhole,
  Mic,
  Paperclip,
  ShieldCheck,
  Sparkles,
  UserRound,
  Search,
  BadgeCheck,
  MonitorSmartphone,
} from "lucide-react";

export default function Landing() {
  const { lang, setLang } = useI18n();
  const tr = useTr();

  const steps = [
    { icon: Mic, title: tr({ en: "Tell us what happened", hi: "बताइए क्या हुआ", kn: "ಏನಾಯಿತು ಎಂದು ಹೇಳಿ" }) },
    { icon: Search, title: tr({ en: "See the help available", hi: "आपको कौन सी मदद मिल सकती है", kn: "ನಿಮಗೆ ಸಿಗುವ ಸಹಾಯ ನೋಡಿ" }) },
    { icon: MonitorSmartphone, title: tr({ en: "Fill the form together", hi: "साथ मिलकर फ़ॉर्म भरिए", kn: "ಒಟ್ಟಿಗೆ ಫಾರ್ಮ್ ತುಂಬಿರಿ" }) },
  ];

  const trust = [
    {
      icon: BadgeCheck,
      title: tr({ en: "Answers are sourced", hi: "हर जवाब का स्रोत दिखता है", kn: "ಪ್ರತಿ ಉತ್ತರದ ಮೂಲ ಕಾಣುತ್ತದೆ" }),
      text: tr({ en: "Every answer links to its official document.", hi: "हर जवाब अपने आधिकारिक दस्तावेज़ से जुड़ा है।", kn: "ಪ್ರತಿ ಉತ್ತರ ಅದರ ಅಧಿಕೃತ ದಾಖಲೆಗೆ ಲಿಂಕ್ ಆಗಿದೆ." }),
    },
    {
      icon: Hand,
      title: tr({ en: "You approve everything", hi: "आपकी हाँ के बिना कुछ नहीं भरा जाता", kn: "ನಿಮ್ಮ ಅನುಮತಿ ಇಲ್ಲದೆ ಏನೂ ಬರೆಯಲ್ಲ" }),
      text: tr({ en: "Nothing is filled until you say yes.", hi: "आपकी हाँ के बिना कुछ नहीं भरा जाता।", kn: "ನೀವು ಹೌದು ಎನ್ನುವವರೆಗೆ ಏನೂ ತುಂಬುವುದಿಲ್ಲ." }),
    },
    {
      icon: ShieldCheck,
      title: tr({ en: "Your data is secure", hi: "आपके नंबर छिपे रहते हैं", kn: "ನಿಮ್ಮ ಡೇಟಾ ಸುರಕ್ಷಿತ" }),
      text: tr({ en: "Aadhaar and bank numbers stay masked.", hi: "आधार और बैंक नंबर छिपे रहते हैं।", kn: "ಆಧಾರ್ ಮತ್ತು ಬ್ಯಾಂಕ್ ಸಂಖ್ಯೆಗಳು ಮರೆಯಾಗಿರುತ್ತವೆ." }),
    },
  ];

  return (
    <div className="relative p-0 m-0">
      {/* Hero */}

<section className="relative isolate overflow-hidden bg-forest-950 text-white">
  {/* Government building background */}
{/* Government building background */}
<div className="pointer-events-none absolute inset-y-0 left-0 z-0 w-[58%] overflow-hidden">
  <img
    src="/government-building.png"
    alt=""
    className="
      absolute bottom-[-30px] left-0
      h-[80%] w-[80%] max-w-none
      object-cover object-left-bottom
      opacity-[0.7]
      [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.25)_10%,black_28%,black_72%,transparent_100%)]
      [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.25)_10%,black_28%,black_72%,transparent_100%)]
    "
  />

  {/* Soft horizontal blend into the hero */}
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-forest-950/30 to-forest-950" />

  {/* Stronger fade at the top */}
  <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-forest-950 via-forest-950/70 to-transparent" />

  {/* Soft fade at the bottom */}
  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-forest-950/80 to-transparent" />


  </div>



  {/* Subtle glow */}
  <div className="pointer-events-none absolute left-[30%] top-[35%] h-[320px] w-[320px] rounded-full bg-forest-600/10 blur-3xl" />


  <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
    <div className="grid min-h-[620px] items-center gap-10 py-14 sm:py-16 lg:grid-cols-[1.15fr_0.95fr] lg:gap-14 lg:py-16">

      {/* LEFT */}
      <div className="relative z-10 max-w-xl">

        {/* Heading — REDUCED */}
        <h1 className="font-display w-[80%] text-[1.85rem] font-bold leading-[1.1] tracking-[-0.025em] text-white sm:text-[2.35rem] lg:text-[2.85rem] xl:text-[3.05rem]">
          {tr({
            en: "Government help, in your language.",
            hi: "सरकारी मदद, आपकी भाषा में।",
            kn: "ಸರ್ಕಾರಿ ಸಹಾಯ, ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ.",
          })}
        </h1>

        <div className="mt-3 h-1 w-20 rounded-full bg-saffron-600" />

        {/* Description */}
        <p className="mt-5 max-w-[600px] text-sm leading-6 text-forest-200 sm:text-base">
          {tr({
            en: "Speak about your problem. Sahayak finds government schemes for you.",
            hi: "अपनी समस्या बोलकर बताइए। सहायक आपके लिए सरकारी योजनाएँ खोजता है।",
            kn: "ನಿಮ್ಮ ಸಮಸ್ಯೆ ಹೇಳಿ. ಸಹಾಯಕ ನಿಮಗಾಗಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕುತ್ತದೆ.",
          })}
        </p>

        {/* Language */}
        <div className="mt-6">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-forest-300">
            {tr({
              en: "Choose language",
              hi: "भाषा चुनिए",
              kn: "ಭಾಷೆ ಆರಿಸಿ",
            })}
          </div>

          <div
            className="inline-flex rounded-xl border border-forest-700 bg-forest-900/80 p-1"
            role="radiogroup"
            aria-label="Language"
          >
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                role="radio"
                aria-checked={lang === l.code}
                onClick={() => setLang(l.code)}
                className={`min-h-[38px] min-w-[82px] rounded-lg px-3.5 text-[13px] font-semibold transition-all ${
                  lang === l.code
                    ? "bg-white text-forest-950 shadow-sm"
                    : "text-forest-200 hover:bg-forest-800 hover:text-white"
                }`}
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/signup"
            className="group inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-forest-500 px-5 text-[13px] font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-forest-600"
          >
            {tr({
              en: "Start now",
              hi: "अभी शुरू करें",
              kn: "ಈಗಲೇ ಪ್ರಾರಂಭಿಸಿ",
            })}

            <ArrowRight
              size={17}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>

          <Link
            to="/signin"
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-forest-500 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            <UserRound size={16} />

            {tr({
              en: "Sign in",
              hi: "साइन इन करें",
              kn: "ಸೈನ್ ಇನ್ ಮಾಡಿ",
            })}
          </Link>
        </div>

        </div>

      {/* RIGHT — ASSISTANT PREVIEW */}
      <div className="relative z-10 w-[90%]">

        <div
          className="overflow-hidden rounded-[20px] border border-white/50 bg-paper shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
          aria-hidden
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-paper-300 bg-white px-8 py-3">
            

            <div>
              <div className="text-sm font-bold text-ink-900">
                Sahayak
              </div>

              <div className="text-[11px] text-ink-500">
                Public Service Assistant
              </div>
            </div>

            <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-forest-700">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
              {tr({
                en: "Listening",
                hi: "सुन रहा है",
                kn: "ಕೇಳುತ್ತಿದೆ",
              })}
            </span>
          </div>

          {/* Conversation */}
          <div className="space-y-3 bg-paper-100 p-4">

            {/* User */}
            <div className="flex justify-end">
              <div className="flex max-w-[88%] items-start gap-2 rounded-xl rounded-tr-sm bg-forest-800 px-3 py-2 text-[13px] leading-5 text-white">
                

                {tr({
                  en: "Heavy rain destroyed my crop. What help can I get?",
                  hi: "भारी बारिश से मेरी फसल बर्बाद हो गई। मुझे क्या मदद मिल सकती है?",
                  kn: "ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ಹಾಳಾಯಿತು. ನನಗೆ ಯಾವ ಸಹಾಯ ಸಿಗಬಹುದು?",
                })}
              </div>
            </div>

            {/* Assistant */}
            <div className="flex gap-2">
              <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white text-forest-800 ring-1 ring-paper-300">
                <Bot size={14} />
              </span>

              <div className="rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[13px] leading-relaxed ring-1 text-forest-800 font-medium ring-paper-300">
                {tr({
                  en: "You may get crop loss relief",
                  hi: "आपको फसल नुकसान राहत मिल सकती है",
                  kn: "ನಿಮಗೆ ಬೆಳೆ ನಷ್ಟ ಪರಿಹಾರ ಸಿಗಬಹುದು",
                })}

                <span className="cite">1</span>.
              </div>
            </div>

            {/* Scheme */}
            <div className="ml-9 rounded-xl border border-paper-300 bg-white p-3.5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-forest-100 text-forest-700">
                  <Landmark size={17} />
                </span>

                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-ink-900">
                    {tr({
                      en: "Crop Loss Input Subsidy",
                      hi: "फसल नुकसान इनपुट सब्सिडी",
                      kn: "ಬೆಳೆ ನಷ್ಟ ಇನ್‌ಪುಟ್ ಸಬ್ಸಿಡಿ",
                    })}
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 text-xs text-forest-700">

                    {tr({
                      en: "Money per hectare of damaged crop",
                      hi: "नुकसान वाली फसल के हर हेक्टेयर पर पैसा",
                      kn: "ಹಾಳಾದ ಪ್ರತಿ ಹೆಕ್ಟೇರ್ ಬೆಳೆಗೆ ಹಣ",
                    })}
                  </div>

                  <div className="mt-2.5 flex gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-forest-800 px-2.5 py-1.5 text-xs font-semibold text-white">
                      {tr({
                        en: "Apply",
                        hi: "आवेदन करें",
                        kn: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ",
                      })}

                      <ArrowRight size={12} />
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700">
                      <FileCheck2 size={12} />

                      {tr({
                        en: "Papers needed",
                        hi: "ज़रूरी कागज़",
                        kn: "ಬೇಕಾದ ದಾಖಲೆಗಳು",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-paper-300 bg-white p-3">
            <div className="flex items-center gap-2 rounded-lg border border-paper-300 bg-paper-100 px-3 py-2">
              <Paperclip size={15} className="text-ink-400" />

              <span className="flex-1 text-xs text-ink-400">
                {tr({
                  en: "Tell us what happened...",
                  hi: "बताइए क्या हुआ...",
                  kn: "ಏನಾಯಿತು ಎಂದು ಹೇಳಿ...",
                })}
              </span>

              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-700 text-white">
                <Mic size={14} />
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</section>
      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="mb-8 flex items-end gap-4">
          <h2 className="font-display text-xl font-bold sm:text-2xl">{tr({ en: "How it works", hi: "यह कैसे काम करता है", kn: "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ" })}</h2>
          <div className="mb-2 hidden h-px flex-1 bg-paper-300 sm:block" />
        </div>
        <ol className="relative grid gap-4 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-[2.9rem] hidden h-px border-t-2 border-dashed border-forest-200 md:block" />
          {steps.map(({ icon: Icon, title }, i) => (
            <li key={i} className="card group relative p-5 transition-all hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-lift">
              <div className="flex items-center justify-between">
                <span className="relative flex h-12 w-12 items-center justify-center rounded-lg bg-forest-800 text-white"><Icon size={22} /></span>
                <span className="font-display text-3xl font-bold text-paper-300 transition-colors group-hover:text-saffron/40" aria-hidden>0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-bold leading-snug text-ink-900"><span className="sr-only">{i + 1}. </span>{title}</h3>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section className="border-y border-forest-100 bg-forest-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="mb-8 flex items-end gap-4">
            <h2 className="font-display text-xl font-bold sm:text-2xl">{tr({ en: "Safe and secure", hi: "सुरक्षित और विश्वसनीय", kn: "ಸುರಕ್ಷಿತ ಮತ್ತು ವಿಶ್ವಾಸಾರ್ಹ" })}</h2>
            <div className="mb-2 hidden h-px flex-1 bg-forest-100 sm:block" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {trust.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-forest-100 bg-white p-5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-forest-50 text-forest-700 ring-1 ring-forest-100"><Icon size={20} /></span>
                <h3 className="mt-3.5 font-bold text-ink-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="relative overflow-hidden rounded-xl bg-forest-900 px-6 py-9 text-white sm:px-10">
          <Wheel className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 text-white opacity-[0.07]" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{tr({ en: "Ready to get started?", hi: "शुरू करने के लिए तैयार हैं?", kn: "ಪ್ರಾರಂಭಿಸಲು ಸಿದ್ಧರಾ?" })}</h2>
              <p className="mt-1.5 text-forest-200">{tr({ en: "Try the demo or create your account.", hi: "डेमो आज़माएँ या खाता बनाएँ।", kn: "ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಖಾತೆ ರಚಿಸಿ." })}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/signin?demo=citizen" className="btn-accent btn-lg">
                {tr({ en: "Try demo", hi: "डेमो आज़माएँ", kn: "ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ" })} <ArrowRight size={18} />
              </Link>
              <Link to="/signup" className="btn btn-lg border border-forest-500 text-white hover:bg-forest-800">
                {tr({ en: "Create account", hi: "खाता बनाएँ", kn: "ಖಾತೆ ರಚಿಸಿ" })}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}