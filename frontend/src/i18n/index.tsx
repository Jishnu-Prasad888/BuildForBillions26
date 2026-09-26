import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "@/types";

export const LANGUAGES: { code: Lang; label: string; native: string; speech: string }[] = [
  { code: "en", label: "English", native: "English", speech: "en-IN" },
  { code: "hi", label: "Hindi", native: "हिन्दी", speech: "hi-IN" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", speech: "kn-IN" },
];

type Dict = Record<string, { en: string; hi: string; kn: string }>;

const D: Dict = {
  dashboard: { en: "Dashboard", hi: "डैशबोर्ड", kn: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್" },
  assistant: { en: "Assistant", hi: "सहायक", kn: "ಸಹಾಯಕ" },
  schemes: { en: "Schemes", hi: "योजनाएँ", kn: "ಯೋಜನೆಗಳು" },
  applications: { en: "Applications", hi: "आवेदन", kn: "ಅರ್ಜಿಗಳು" },
  documents: { en: "Documents", hi: "दस्तावेज़", kn: "ದಾಖಲೆಗಳು" },
  notes: { en: "Notes", hi: "नोट्स", kn: "ಟಿಪ್ಪಣಿಗಳು" },
  profile: { en: "Profile", hi: "प्रोफ़ाइल", kn: "ಪ್ರೊಫೈಲ್" },
  sign_out: { en: "Sign out", hi: "साइन आउट", kn: "ಸೈನ್ ಔಟ್" },
  welcome_back: { en: "Welcome back", hi: "फिर से स्वागत है", kn: "ಮರಳಿ ಸ್ವಾಗತ" },
  what_help: { en: "What do you need help with?", hi: "आपको किस चीज़ में मदद चाहिए?", kn: "ನಿಮಗೆ ಯಾವುದರಲ್ಲಿ ಸಹಾಯ ಬೇಕು?" },
  talk_assistant: { en: "Talk to Assistant", hi: "सहायक से बात करें", kn: "ಸಹಾಯಕರೊಂದಿಗೆ ಮಾತನಾಡಿ" },
  talk_assistant_sub: { en: "Describe your situation by voice or text", hi: "बोलकर या लिखकर अपनी स्थिति बताएँ", kn: "ಧ್ವನಿ ಅಥವಾ ಪಠ್ಯದಲ್ಲಿ ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿ ತಿಳಿಸಿ" },
  find_scheme: { en: "Find a Scheme", hi: "योजना खोजें", kn: "ಯೋಜನೆ ಹುಡುಕಿ" },
  find_scheme_sub: { en: "See what you may be eligible for", hi: "देखें आप किसके पात्र हो सकते हैं", kn: "ನೀವು ಯಾವುದಕ್ಕೆ ಅರ್ಹರಾಗಬಹುದು ನೋಡಿ" },
  help_fill: { en: "Help Me Fill a Form", hi: "फ़ॉर्म भरने में मदद", kn: "ಫಾರ್ಮ್ ತುಂಬಲು ಸಹಾಯ" },
  help_fill_sub: { en: "AI guides you field by field", hi: "AI हर फ़ील्ड में मार्गदर्शन करेगा", kn: "AI ಪ್ರತಿ ಕ್ಷೇತ್ರದಲ್ಲಿ ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತದೆ" },
  continue_app: { en: "Continue Application", hi: "आवेदन जारी रखें", kn: "ಅರ್ಜಿ ಮುಂದುವರಿಸಿ" },
  continue_app_sub: { en: "Pick up where you left off", hi: "जहाँ छोड़ा था वहीं से शुरू करें", kn: "ನಿಲ್ಲಿಸಿದಲ್ಲಿಂದ ಮುಂದುವರಿಸಿ" },
  active_apps: { en: "Active applications", hi: "सक्रिय आवेदन", kn: "ಸಕ್ರಿಯ ಅರ್ಜಿಗಳು" },
  recent_docs: { en: "Recent documents", hi: "हाल के दस्तावेज़", kn: "ಇತ್ತೀಚಿನ ದಾಖಲೆಗಳು" },
  pending_actions: { en: "Pending actions", hi: "बाकी काम", kn: "ಬಾಕಿ ಕೆಲಸಗಳು" },
  recent_notes: { en: "Recent notes", hi: "हाल के नोट्स", kn: "ಇತ್ತೀಚಿನ ಟಿಪ್ಪಣಿಗಳು" },
  ask_placeholder: { en: "Type your question, or press the mic and speak…", hi: "अपना सवाल लिखें, या माइक दबाकर बोलें…", kn: "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ, ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ…" },
  send: { en: "Send", hi: "भेजें", kn: "ಕಳುಹಿಸಿ" },
  sources_used: { en: "Sources used", hi: "उपयोग किए गए स्रोत", kn: "ಬಳಸಿದ ಮೂಲಗಳು" },
  apply: { en: "Apply", hi: "आवेदन करें", kn: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ" },
  track: { en: "Track application", hi: "आवेदन ट्रैक करें", kn: "ಅರ್ಜಿ ಟ್ರ್ಯಾಕ್ ಮಾಡಿ" },
  listening: { en: "Listening…", hi: "सुन रहा हूँ…", kn: "ಕೇಳುತ್ತಿದ್ದೇನೆ…" },
  thinking: { en: "Checking official sources…", hi: "आधिकारिक स्रोत देख रहा हूँ…", kn: "ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ಪರಿಶೀಲಿಸುತ್ತಿದ್ದೇನೆ…" },
  my_notes: { en: "My notes", hi: "मेरे नोट्स", kn: "ನನ್ನ ಟಿಪ್ಪಣಿಗಳು" },
  ai_notes: { en: "AI notes", hi: "AI नोट्स", kn: "AI ಟಿಪ್ಪಣಿಗಳು" },
  form_progress: { en: "Form progress", hi: "फ़ॉर्म प्रगति", kn: "ಫಾರ್ಮ್ ಪ್ರಗತಿ" },
  help_me_fill_this: { en: "Help Me Fill This Form", hi: "यह फ़ॉर्म भरने में मदद करें", kn: "ಈ ಫಾರ್ಮ್ ತುಂಬಲು ಸಹಾಯ ಮಾಡಿ" },
  review: { en: "Review", hi: "समीक्षा", kn: "ಪರಿಶೀಲನೆ" },
  end_assistance: { en: "End assistance", hi: "सहायता समाप्त करें", kn: "ಸಹಾಯ ಮುಗಿಸಿ" },
  mute: { en: "Mute", hi: "म्यूट", kn: "ಮ್ಯೂಟ್" },
  unmute: { en: "Unmute", hi: "अनम्यूट", kn: "ಅನ್‌ಮ್ಯೂಟ್" },
  type: { en: "Type", hi: "लिखें", kn: "ಟೈಪ್" },
  add_to_notes: { en: "Add to my notes", hi: "मेरे नोट्स में जोड़ें", kn: "ನನ್ನ ಟಿಪ್ಪಣಿಗಳಿಗೆ ಸೇರಿಸಿ" },
  language: { en: "Language", hi: "भाषा", kn: "ಭಾಷೆ" },
  speak_answers: { en: "Read answers aloud", hi: "उत्तर पढ़कर सुनाएँ", kn: "ಉತ್ತರಗಳನ್ನು ಓದಿ ಹೇಳಿ" },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx>(null as unknown as I18nCtx);
const KEY = "sahayak.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem(KEY) as Lang) || "en");
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    localStorage.setItem(KEY, l);
    setLangState(l);
  };
  const t = (key: string) => D[key]?.[lang] ?? D[key]?.en ?? key;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const speechLang = (l: Lang) => LANGUAGES.find((x) => x.code === l)?.speech ?? "en-IN";
