import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Accessibility,
  BadgeCheck,
  Briefcase,
  EyeOff,
  FileText,
  GraduationCap,
  Hand,
  HeartPulse,
  Home,
  Landmark,
  Menu,
  Mic,
  PauseCircle,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Square,
  Store,
  Users,
  Volume2,
  Wheat,
  X,
} from "lucide-react";
import { LANGUAGES, useI18n, useTr, type Tri } from "@/i18n";
import { speak, stopSpeaking } from "@/hooks/useSpeech";

/* ---------- Content ---------- */
/* Existing step-by-step content is unchanged from the original page — it has
   already been through translation and review, so it is reused as-is. */

type Step = { title: Tri; text: Tri; tip?: Tri };

const PHASES: { title: Tri; steps: Step[] }[] = [
  {
    title: { en: "Get started", hi: "शुरुआत", kn: "ಪ್ರಾರಂಭ" },
    steps: [
      {
        title: {
          en: "Choose your language",
          hi: "अपनी भाषा चुनिए",
          kn: "ನಿಮ್ಮ ಭಾಷೆ ಆರಿಸಿ",
        },
        text: {
          en: "At the top of the screen, tap the language box and pick English, हिन्दी or ಕನ್ನಡ. Everything, including the voice, changes to that language.",
          hi: "स्क्रीन के ऊपर भाषा वाले डिब्बे पर दबाइए और English, हिन्दी या ಕನ್ನಡ चुनिए। सब कुछ, आवाज़ भी, उसी भाषा में हो जाएगा।",
          kn: "ಪರದೆಯ ಮೇಲ್ಭಾಗದಲ್ಲಿ ಭಾಷೆಯ ಪೆಟ್ಟಿಗೆ ಒತ್ತಿ English, हिन्दी ಅಥವಾ ಕನ್ನಡ ಆರಿಸಿ. ಧ್ವನಿಯೂ ಸೇರಿದಂತೆ ಎಲ್ಲವೂ ಆ ಭಾಷೆಗೆ ಬದಲಾಗುತ್ತದೆ.",
        },
      },
      {
        title: { en: "Sign in", hi: "साइन इन कीजिए", kn: "ಸೈನ್ ಇನ್ ಮಾಡಿ" },
        text: {
          en: "Tap “Sign in” and enter your email and password. New here? Tap “Create an account”. To only practise, tap “Try the demo”.",
          hi: "“साइन इन” दबाइए और अपना ईमेल और पासवर्ड डालिए। पहली बार? “खाता बनाएँ” दबाइए। सिर्फ़ अभ्यास के लिए “डेमो आज़माएँ” दबाइए।",
          kn: "“ಸೈನ್ ಇನ್” ಒತ್ತಿ ನಿಮ್ಮ ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಹಾಕಿ. ಹೊಸಬರೇ? “ಖಾತೆ ರಚಿಸಿ” ಒತ್ತಿ. ಅಭ್ಯಾಸಕ್ಕೆ ಮಾತ್ರ “ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ” ಒತ್ತಿ.",
        },
      },
    ],
  },
  {
    title: { en: "Find help", hi: "मदद खोजिए", kn: "ಸಹಾಯ ಹುಡುಕಿ" },
    steps: [
      {
        title: {
          en: "Tell the assistant your problem",
          hi: "सहायक को अपनी समस्या बताइए",
          kn: "ಸಹಾಯಕನಿಗೆ ನಿಮ್ಮ ಸಮಸ್ಯೆ ಹೇಳಿ",
        },
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
        title: {
          en: "Read or listen to the answer",
          hi: "जवाब पढ़िए या सुनिए",
          kn: "ಉತ್ತರ ಓದಿ ಅಥವಾ ಕೇಳಿ",
        },
        text: {
          en: "Tap “Listen” to hear the answer. Small numbers like [1] show where the answer came from. Tap one to see the official paper.",
          hi: "जवाब सुनने के लिए “सुनें” दबाइए। [1] जैसे छोटे नंबर बताते हैं कि जवाब कहाँ से आया। आधिकारिक कागज़ देखने के लिए उस पर दबाइए।",
          kn: "ಉತ್ತರ ಕೇಳಲು “ಕೇಳಿ” ಒತ್ತಿ. [1] ಹಾಗಿನ ಸಣ್ಣ ಸಂಖ್ಯೆಗಳು ಉತ್ತರ ಎಲ್ಲಿಂದ ಬಂತು ಎಂದು ತೋರಿಸುತ್ತವೆ. ಅಧಿಕೃತ ದಾಖಲೆ ನೋಡಲು ಅದನ್ನು ಒತ್ತಿ.",
        },
      },
      {
        title: {
          en: "Pick a scheme and tap Apply",
          hi: "योजना चुनिए और “आवेदन करें” दबाइए",
          kn: "ಯೋಜನೆ ಆರಿಸಿ “ಅರ್ಜಿ ಸಲ್ಲಿಸಿ” ಒತ್ತಿ",
        },
        text: {
          en: "Under the answer you will see scheme cards. Each shows the money or help you get and the papers you need. Tap the orange “Apply” button.",
          hi: "जवाब के नीचे योजना के कार्ड दिखेंगे। हर कार्ड में मिलने वाली मदद और ज़रूरी कागज़ लिखे हैं। नारंगी “आवेदन करें” बटन दबाइए।",
          kn: "ಉತ್ತರದ ಕೆಳಗೆ ಯೋಜನೆಯ ಕಾರ್ಡ್‌ಗಳು ಕಾಣುತ್ತವೆ. ಪ್ರತಿಯೊಂದರಲ್ಲೂ ಸಿಗುವ ಸಹಾಯ ಮತ್ತು ಬೇಕಾದ ದಾಖಲೆಗಳು ಇವೆ. ಕಿತ್ತಳೆ ಬಣ್ಣದ “ಅರ್ಜಿ ಸಲ್ಲಿಸಿ” ಬಟನ್ ಒತ್ತಿ.",
        },
      },
    ],
  },
  {
    title: { en: "Apply", hi: "आवेदन कीजिए", kn: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ" },
    steps: [
      {
        title: {
          en: "Fill the form with the helper",
          hi: "सहायक के साथ फ़ॉर्म भरिए",
          kn: "ಸಹಾಯಕನೊಂದಿಗೆ ಫಾರ್ಮ್ ತುಂಬಿರಿ",
        },
        text: {
          en: "Tap “Help Me Fill This Form”. The helper asks one question at a time. Answer by speaking. Say “I don't know” to leave a question for later.",
          hi: "“यह फ़ॉर्म भरने में मदद करें” दबाइए। सहायक एक बार में एक सवाल पूछेगा। बोलकर जवाब दीजिए। किसी सवाल को बाद के लिए छोड़ने को “मुझे नहीं पता” कहिए।",
          kn: "“ಈ ಫಾರ್ಮ್ ತುಂಬಲು ಸಹಾಯ ಮಾಡಿ” ಒತ್ತಿ. ಸಹಾಯಕ ಒಂದು ಬಾರಿಗೆ ಒಂದು ಪ್ರಶ್ನೆ ಕೇಳುತ್ತದೆ. ಮಾತಿನಲ್ಲಿ ಉತ್ತರಿಸಿ. ಪ್ರಶ್ನೆಯನ್ನು ನಂತರಕ್ಕೆ ಬಿಡಲು “ನನಗೆ ಗೊತ್ತಿಲ್ಲ” ಎನ್ನಿ.",
        },
      },
      {
        title: {
          en: "Say “yes” to fill each answer",
          hi: "हर जवाब भरने के लिए “हाँ” कहिए",
          kn: "ಪ್ರತಿ ಉತ್ತರ ತುಂಬಲು “ಹೌದು” ಎನ್ನಿ",
        },
        text: {
          en: "The helper shows what it will write. Say “yes” or tap “Fill field” to put it in the form. Tap “Don't fill” if it is wrong.",
          hi: "सहायक दिखाता है कि वह क्या लिखेगा। फ़ॉर्म में डालने के लिए “हाँ” कहिए या “भरें” दबाइए। गलत हो तो “न भरें” दबाइए।",
          kn: "ಸಹಾಯಕ ತಾನು ಏನು ಬರೆಯುತ್ತದೆ ಎಂದು ತೋರಿಸುತ್ತದೆ. ಫಾರ್ಮ್‌ಗೆ ಹಾಕಲು “ಹೌದು” ಎನ್ನಿ ಅಥವಾ “ತುಂಬಿ” ಒತ್ತಿ. ತಪ್ಪಾಗಿದ್ದರೆ “ತುಂಬಬೇಡಿ” ಒತ್ತಿ.",
        },
      },
      {
        title: {
          en: "Check everything and submit",
          hi: "सब कुछ जाँचिए और भेजिए",
          kn: "ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸಿ ಕಳುಹಿಸಿ",
        },
        text: {
          en: "When the bar reaches 100%, tap “Review”. Read every answer. Tick the declaration box yourself, then submit.",
          hi: "जब पट्टी 100% हो जाए, “समीक्षा” दबाइए। हर जवाब पढ़िए। घोषणा वाला बॉक्स खुद टिक कीजिए, फिर भेजिए।",
          kn: "ಪಟ್ಟಿ 100% ತಲುಪಿದಾಗ “ಪರಿಶೀಲನೆ” ಒತ್ತಿ. ಪ್ರತಿ ಉತ್ತರ ಓದಿ. ಘೋಷಣೆಯ ಪೆಟ್ಟಿಗೆಯನ್ನು ನೀವೇ ಟಿಕ್ ಮಾಡಿ, ನಂತರ ಕಳುಹಿಸಿ.",
        },
      },
      {
        title: {
          en: "Track your application",
          hi: "अपना आवेदन देखते रहिए",
          kn: "ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಗಮನಿಸಿ",
        },
        text: {
          en: "Open “Applications” to see every application, how far it has gone and what to do next. You can stop at any time and continue later.",
          hi: "“आवेदन” खोलिए। हर आवेदन, वह कहाँ तक पहुँचा और आगे क्या करना है, दिखेगा। आप कभी भी रुककर बाद में जारी रख सकते हैं।",
          kn: "“ಅರ್ಜಿಗಳು” ತೆರೆಯಿರಿ. ಪ್ರತಿ ಅರ್ಜಿ, ಅದು ಎಲ್ಲಿಯವರೆಗೆ ಹೋಗಿದೆ ಮತ್ತು ಮುಂದೆ ಏನು ಮಾಡಬೇಕು ಎಂದು ಕಾಣುತ್ತದೆ. ಯಾವಾಗ ಬೇಕಾದರೂ ನಿಲ್ಲಿಸಿ ನಂತರ ಮುಂದುವರಿಸಬಹುದು.",
        },
      },
    ],
  },
];

const NEED: { icon: typeof Mic; text: Tri }[] = [
  {
    icon: Smartphone,
    text: {
      en: "A phone or computer with internet",
      hi: "इंटरनेट वाला फ़ोन या कंप्यूटर",
      kn: "ಇಂಟರ್ನೆಟ್ ಇರುವ ಫೋನ್ ಅಥವಾ ಕಂಪ್ಯೂಟರ್",
    },
  },
  {
    icon: FileText,
    text: {
      en: "Aadhaar card or driving licence",
      hi: "आधार कार्ड या ड्राइविंग लाइसेंस",
      kn: "ಆಧಾರ್ ಕಾರ್ಡ್ ಅಥವಾ ಡ್ರೈವಿಂಗ್ ಲೈಸೆನ್ಸ್",
    },
  },
  {
    icon: FileText,
    text: {
      en: "Land record (RTC / Pahani)",
      hi: "ज़मीन का रिकॉर्ड (RTC / पहाणी)",
      kn: "ಜಮೀನಿನ ದಾಖಲೆ (RTC / ಪಹಣಿ)",
    },
  },
  {
    icon: FileText,
    text: {
      en: "Bank passbook (first page)",
      hi: "बैंक पासबुक (पहला पन्ना)",
      kn: "ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ (ಮೊದಲ ಪುಟ)",
    },
  },
];

const WORDS: { word: Tri; meaning: Tri }[] = [
  {
    word: { en: "Scheme", hi: "योजना", kn: "ಯೋಜನೆ" },
    meaning: {
      en: "A government programme that gives money or help.",
      hi: "सरकार का कार्यक्रम जो पैसा या मदद देता है।",
      kn: "ಹಣ ಅಥವಾ ಸಹಾಯ ನೀಡುವ ಸರ್ಕಾರಿ ಕಾರ್ಯಕ್ರಮ.",
    },
  },
  {
    word: { en: "Application", hi: "आवेदन", kn: "ಅರ್ಜಿ" },
    meaning: {
      en: "Your request to get help from a scheme.",
      hi: "किसी योजना से मदद पाने का आपका अनुरोध।",
      kn: "ಯೋಜನೆಯಿಂದ ಸಹಾಯ ಪಡೆಯಲು ನಿಮ್ಮ ವಿನಂತಿ.",
    },
  },
  {
    word: { en: "Source", hi: "स्रोत", kn: "ಮೂಲ" },
    meaning: {
      en: "The official paper an answer came from.",
      hi: "वह आधिकारिक कागज़ जिससे जवाब आया।",
      kn: "ಉತ್ತರ ಬಂದ ಅಧಿಕೃತ ದಾಖಲೆ.",
    },
  },
  {
    word: { en: "RTC / Pahani", hi: "RTC / पहाणी", kn: "RTC / ಪಹಣಿ" },
    meaning: {
      en: "Your land record. It has your survey number.",
      hi: "आपकी ज़मीन का रिकॉर्ड। इसमें सर्वे नंबर होता है।",
      kn: "ನಿಮ್ಮ ಜಮೀನಿನ ದಾಖಲೆ. ಇದರಲ್ಲಿ ಸರ್ವೆ ಸಂಖ್ಯೆ ಇರುತ್ತದೆ.",
    },
  },
  {
    word: { en: "IFSC", hi: "IFSC", kn: "IFSC" },
    meaning: {
      en: "An 11-letter bank branch code, printed on your passbook.",
      hi: "बैंक शाखा का 11 अक्षर का कोड, जो पासबुक पर छपा होता है।",
      kn: "ಬ್ಯಾಂಕ್ ಶಾಖೆಯ 11 ಅಕ್ಷರದ ಕೋಡ್, ನಿಮ್ಮ ಪಾಸ್‌ಬುಕ್‌ನಲ್ಲಿ ಮುದ್ರಿತವಾಗಿರುತ್ತದೆ.",
    },
  },
  {
    word: { en: "OTP", hi: "OTP", kn: "OTP" },
    meaning: {
      en: "A secret number sent by SMS. Never tell it to anyone, not even Sahayak.",
      hi: "SMS से आने वाला गुप्त नंबर। इसे कभी किसी को न बताएँ, सहायक को भी नहीं।",
      kn: "SMS ಮೂಲಕ ಬರುವ ರಹಸ್ಯ ಸಂಖ್ಯೆ. ಇದನ್ನು ಯಾರಿಗೂ ಹೇಳಬೇಡಿ, ಸಹಾಯಕನಿಗೂ ಸಹ.",
    },
  },
];

const PROMISES: { icon: typeof Mic; text: Tri }[] = [
  {
    icon: BadgeCheck,
    text: {
      en: "Every answer shows its official source",
      hi: "हर जवाब का आधिकारिक स्रोत दिखता है",
      kn: "ಪ್ರತಿ ಉತ್ತರದ ಅಧಿಕೃತ ಮೂಲ ಕಾಣುತ್ತದೆ",
    },
  },
  {
    icon: Hand,
    text: {
      en: "Nothing goes on a form without your “yes”",
      hi: "आपकी “हाँ” के बिना फ़ॉर्म में कुछ नहीं जाता",
      kn: "ನಿಮ್ಮ “ಹೌದು” ಇಲ್ಲದೆ ಫಾರ್ಮ್‌ಗೆ ಏನೂ ಹೋಗುವುದಿಲ್ಲ",
    },
  },
  {
    icon: EyeOff,
    text: {
      en: "Aadhaar and bank numbers stay hidden",
      hi: "आधार और बैंक नंबर छिपे रहते हैं",
      kn: "ಆಧಾರ್ ಮತ್ತು ಬ್ಯಾಂಕ್ ಸಂಖ್ಯೆಗಳು ಮರೆಯಾಗಿರುತ್ತವೆ",
    },
  },
];

/* ---------- New content added for this redesign ---------- */
/* Marked with a review note where it introduces fresh Hindi/Kannada copy —
   worth a native-speaker check before shipping, same as any new translation. */

const OVERVIEW: { icon: typeof Mic; title: Tri; text: Tri }[] = [
  {
    icon: Mic,
    title: {
      en: "Speak naturally",
      hi: "अपनी भाषा में बोलिए",
      kn: "ಸ್ವಾಭಾವಿಕವಾಗಿ ಮಾತನಾಡಿ",
    },
    text: {
      en: "Tell the assistant your problem, in your own words and your own language.",
      hi: "अपनी समस्या अपने शब्दों और अपनी भाषा में सहायक को बताइए।",
      kn: "ನಿಮ್ಮ ಸಮಸ್ಯೆಯನ್ನು ನಿಮ್ಮದೇ ಮಾತಿನಲ್ಲಿ ಮತ್ತು ಭಾಷೆಯಲ್ಲಿ ಸಹಾಯಕನಿಗೆ ಹೇಳಿ.",
    },
  },
  {
    icon: Sparkles,
    title: {
      en: "The assistant finds schemes",
      hi: "सहायक योजनाएँ खोजता है",
      kn: "ಸಹಾಯಕ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕುತ್ತದೆ",
    },
    text: {
      en: "Every answer links back to an official government source.",
      hi: "हर जवाब किसी आधिकारिक सरकारी स्रोत से जुड़ा होता है।",
      kn: "ಪ್ರತಿ ಉತ್ತರವು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಮೂಲಕ್ಕೆ ಲಿಂಕ್ ಆಗಿರುತ್ತದೆ.",
    },
  },
  {
    icon: Hand,
    title: {
      en: "You fill the form together",
      hi: "आप मिलकर फ़ॉर्म भरते हैं",
      kn: "ನೀವಿಬ್ಬರೂ ಸೇರಿ ಫಾರ್ಮ್ ತುಂಬುತ್ತೀರಿ",
    },
    text: {
      en: "Nothing is submitted until you say yes to every answer.",
      hi: "जब तक आप हर जवाब पर हाँ नहीं कहते, कुछ भी नहीं भेजा जाता।",
      kn: "ಪ್ರತಿ ಉತ್ತರಕ್ಕೆ ನೀವು ಹೌದು ಎನ್ನುವವರೆಗೆ ಏನನ್ನೂ ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ.",
    },
  },
];

const AUDIENCES: { icon: typeof Mic; label: Tri }[] = [
  { icon: Wheat, label: { en: "Farmers", hi: "किसान", kn: "ರೈತರು" } },
  {
    icon: GraduationCap,
    label: { en: "Students", hi: "छात्र", kn: "ವಿದ್ಯಾರ್ಥಿಗಳು" },
  },
  {
    icon: Users,
    label: {
      en: "Senior citizens",
      hi: "वरिष्ठ नागरिक",
      kn: "ಹಿರಿಯ ನಾಗರಿಕರು",
    },
  },
  {
    icon: Users,
    label: {
      en: "Women & self-help groups",
      hi: "महिलाएँ और स्वयं सहायता समूह",
      kn: "ಮಹಿಳೆಯರು ಮತ್ತು ಸ್ವಸಹಾಯ ಗುಂಪುಗಳು",
    },
  },
  {
    icon: Store,
    label: { en: "Small business", hi: "छोटा व्यवसाय", kn: "ಸಣ್ಣ ವ್ಯಾಪಾರ" },
  },
  { icon: HeartPulse, label: { en: "Health", hi: "स्वास्थ्य", kn: "ಆರೋಗ್ಯ" } },
  { icon: Home, label: { en: "Housing", hi: "आवास", kn: "ವಸತಿ" } },
  {
    icon: Accessibility,
    label: {
      en: "Disability support",
      hi: "दिव्यांग सहायता",
      kn: "ಅಂಗವಿಕಲ ಸಹಾಯ",
    },
  },
  { icon: Briefcase, label: { en: "Jobs", hi: "रोज़गार", kn: "ಉದ್ಯೋಗ" } },
];

const TRUST_CARDS: { icon: typeof Mic; title: Tri; text: Tri }[] = [
  {
    icon: BadgeCheck,
    title: {
      en: "Sources you can check",
      hi: "जाँचने लायक स्रोत",
      kn: "ಪರಿಶೀಲಿಸಬಹುದಾದ ಮೂಲಗಳು",
    },
    text: {
      en: "Every answer links to the official government page it came from, so you can read it yourself.",
      hi: "हर जवाब उस आधिकारिक सरकारी पेज से जुड़ा होता है जहाँ से वह आया, ताकि आप खुद पढ़ सकें।",
      kn: "ಪ್ರತಿ ಉತ್ತರವು ಅದು ಬಂದ ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಪುಟಕ್ಕೆ ಲಿಂಕ್ ಆಗಿರುತ್ತದೆ, ಇದರಿಂದ ನೀವೇ ಓದಬಹುದು.",
    },
  },
  {
    icon: Hand,
    title: {
      en: "You decide, every time",
      hi: "हर बार फैसला आपका",
      kn: "ಪ್ರತಿ ಬಾರಿ ನಿರ್ಧಾರ ನಿಮ್ಮದು",
    },
    text: {
      en: "The assistant shows what it will write before it writes it. Nothing goes into a form without your yes.",
      hi: "सहायक लिखने से पहले दिखाता है कि वह क्या लिखेगा। आपकी “हाँ” के बिना फ़ॉर्म में कुछ नहीं जाता।",
      kn: "ಸಹಾಯಕ ಬರೆಯುವ ಮೊದಲು ಏನು ಬರೆಯುತ್ತದೆ ಎಂದು ತೋರಿಸುತ್ತದೆ. ನಿಮ್ಮ “ಹೌದು” ಇಲ್ಲದೆ ಫಾರ್ಮ್‌ಗೆ ಏನೂ ಹೋಗುವುದಿಲ್ಲ.",
    },
  },
  {
    icon: EyeOff,
    title: {
      en: "Sensitive numbers stay hidden",
      hi: "संवेदनशील नंबर छिपे रहते हैं",
      kn: "ಸೂಕ್ಷ್ಮ ಸಂಖ್ಯೆಗಳು ಮರೆಯಾಗಿರುತ್ತವೆ",
    },
    text: {
      en: "Your Aadhaar and bank numbers are masked on screen, and Sahayak never asks for your OTP or password.",
      hi: "आपका आधार और बैंक नंबर स्क्रीन पर छिपाया जाता है, और सहायक कभी आपका OTP या पासवर्ड नहीं माँगता।",
      kn: "ನಿಮ್ಮ ಆಧಾರ್ ಮತ್ತು ಬ್ಯಾಂಕ್ ಸಂಖ್ಯೆಗಳನ್ನು ಪರದೆಯ ಮೇಲೆ ಮರೆಮಾಡಲಾಗುತ್ತದೆ, ಮತ್ತು ಸಹಾಯಕ ಎಂದಿಗೂ ನಿಮ್ಮ OTP ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಕೇಳುವುದಿಲ್ಲ.",
    },
  },
  {
    icon: PauseCircle,
    title: {
      en: "Stop and come back anytime",
      hi: "कभी भी रोकें और वापस आएँ",
      kn: "ಯಾವಾಗ ಬೇಕಾದರೂ ನಿಲ್ಲಿಸಿ, ಮತ್ತೆ ಬನ್ನಿ",
    },
    text: {
      en: "Every application is saved as you go. Close the page and continue later from exactly where you left off.",
      hi: "हर आवेदन अपने आप सेव होता जाता है। पेज बंद कीजिए और जहाँ छोड़ा था वहीं से बाद में जारी रखिए।",
      kn: "ಪ್ರತಿ ಅರ್ಜಿ ನೀವು ಮುಂದುವರಿದಂತೆ ಉಳಿಸಲ್ಪಡುತ್ತದೆ. ಪುಟ ಮುಚ್ಚಿ, ನೀವು ಬಿಟ್ಟ ಸ್ಥಳದಿಂದಲೇ ನಂತರ ಮುಂದುವರಿಸಿ.",
    },
  },
];

/* Example conversations for the hero demo card. Content and structure follow
   the original hero example; the pension and small-business examples are new
   and should get a native-speaker translation review before shipping. */
const DEMOS: {
  id: string;
  chip: Tri;
  query: Tri;
  answer: Tri[];
  schemeName: Tri;
  schemeBenefit: Tri;
}[] = [
  {
    id: "crop",
    chip: { en: "Crop damage", hi: "फसल नुकसान", kn: "ಬೆಳೆ ಹಾನಿ" },
    query: {
      en: "Heavy rain destroyed my crop. What help can I get?",
      hi: "भारी बारिश से मेरी फसल बर्बाद हो गई। मुझे क्या मदद मिल सकती है?",
      kn: "ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ಹಾಳಾಯಿತು. ನನಗೆ ಯಾವ ಸಹಾಯ ಸಿಗಬಹುದು?",
    },
    answer: [
      {
        en: "You may get crop loss relief.",
        hi: "आपको फसल नुकसान राहत मिल सकती है।",
        kn: "ನಿಮಗೆ ಬೆಳೆ ನಷ್ಟ ಪರಿಹಾರ ಸಿಗಬಹುದು.",
      },
      {
        en: "Report the damage within 72 hours for crop insurance.",
        hi: "फसल बीमा के लिए 72 घंटों में नुकसान की सूचना दें।",
        kn: "ಬೆಳೆ ವಿಮೆಗಾಗಿ 72 ಗಂಟೆಗಳಲ್ಲಿ ಹಾನಿಯನ್ನು ತಿಳಿಸಿ.",
      },
    ],
    schemeName: {
      en: "Crop Loss Input Subsidy",
      hi: "फसल नुकसान इनपुट सब्सिडी",
      kn: "ಬೆಳೆ ನಷ್ಟ ಇನ್‌ಪುಟ್ ಸಬ್ಸಿಡಿ",
    },
    schemeBenefit: {
      en: "Money per hectare of damaged crop",
      hi: "नुकसान वाली फसल के हर हेक्टेयर पर पैसा",
      kn: "ಹಾಳಾದ ಪ್ರತಿ ಹೆಕ್ಟೇರ್ ಬೆಳೆಗೆ ಹಣ",
    },
  },
  {
    id: "pension",
    chip: { en: "Pension", hi: "पेंशन", kn: "ಪಿಂಚಣಿ" },
    query: {
      en: "My mother is 62 with no income. Can she get a pension?",
      hi: "मेरी माँ 62 साल की हैं और उनकी कोई आय नहीं है। क्या उन्हें पेंशन मिल सकती है?",
      kn: "ನನ್ನ ತಾಯಿಗೆ 62 ವರ್ಷ, ಯಾವುದೇ ಆದಾಯ ಇಲ್ಲ. ಅವರಿಗೆ ಪಿಂಚಣಿ ಸಿಗಬಹುದೇ?",
    },
    answer: [
      {
        en: "She may be eligible for an old-age pension.",
        hi: "उन्हें वृद्धावस्था पेंशन मिल सकती है।",
        kn: "ಅವರಿಗೆ ವೃದ್ಧಾಪ್ಯ ಪಿಂಚಣಿ ಸಿಗಬಹುದು.",
      },
      {
        en: "Applications need an Aadhaar card and an income certificate.",
        hi: "आवेदन के लिए आधार कार्ड और आय प्रमाण पत्र चाहिए।",
        kn: "ಅರ್ಜಿಗೆ ಆಧಾರ್ ಕಾರ್ಡ್ ಮತ್ತು ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ ಬೇಕು.",
      },
    ],
    schemeName: {
      en: "Old-Age Pension Scheme",
      hi: "वृद्धावस्था पेंशन योजना",
      kn: "ವೃದ್ಧಾಪ್ಯ ಪಿಂಚಣಿ ಯೋಜನೆ",
    },
    schemeBenefit: {
      en: "Monthly payment for eligible senior citizens",
      hi: "पात्र वरिष्ठ नागरिकों को हर महीने भुगतान",
      kn: "ಅರ್ಹ ಹಿರಿಯ ನಾಗರಿಕರಿಗೆ ಪ್ರತಿ ತಿಂಗಳು ಪಾವತಿ",
    },
  },
  {
    id: "business",
    chip: { en: "Small business", hi: "छोटा व्यवसाय", kn: "ಸಣ್ಣ ವ್ಯಾಪಾರ" },
    query: {
      en: "I want to start a small tailoring shop. Is there a loan scheme?",
      hi: "मैं छोटी सिलाई की दुकान शुरू करना चाहती हूँ। क्या कोई लोन योजना है?",
      kn: "ನಾನು ಸಣ್ಣ ಟೈಲರಿಂಗ್ ಅಂಗಡಿ ಪ್ರಾರಂಭಿಸಬೇಕು. ಸಾಲ ಯೋಜನೆ ಇದೆಯೇ?",
    },
    answer: [
      {
        en: "You may be eligible for a small business loan with a government guarantee.",
        hi: "आपको सरकारी गारंटी वाला छोटा व्यवसाय ऋण मिल सकता है।",
        kn: "ನಿಮಗೆ ಸರ್ಕಾರಿ ಖಾತರಿಯ ಸಣ್ಣ ವ್ಯಾಪಾರ ಸಾಲ ಸಿಗಬಹುದು.",
      },
      {
        en: "No collateral is needed for loans under this scheme.",
        hi: "इस योजना के तहत ऋण के लिए कोई गिरवी नहीं चाहिए।",
        kn: "ಈ ಯೋಜನೆಯಡಿ ಸಾಲಕ್ಕೆ ಯಾವುದೇ ಅಡಮಾನ ಬೇಕಿಲ್ಲ.",
      },
    ],
    schemeName: {
      en: "Small Business Loan Guarantee Scheme",
      hi: "लघु व्यवसाय ऋण गारंटी योजना",
      kn: "ಸಣ್ಣ ವ್ಯಾಪಾರ ಸಾಲ ಖಾತರಿ ಯೋಜನೆ",
    },
    schemeBenefit: {
      en: "Collateral-free loans for new small businesses",
      hi: "नए छोटे व्यवसायों के लिए बिना गिरवी के ऋण",
      kn: "ಹೊಸ ಸಣ್ಣ ವ್ಯಾಪಾರಗಳಿಗೆ ಅಡಮಾನ-ಮುಕ್ತ ಸಾಲ",
    },
  },
];

/* ---------- Small pieces ---------- */

function ListenButton({
  id,
  text,
  playing,
  setPlaying,
}: {
  id: string;
  text: string;
  playing: string | null;
  setPlaying: (v: string | null) => void;
}) {
  const { lang } = useI18n();
  const tr = useTr();
  const on = playing === id;
  return (
    <button
      type="button"
      className={`btn-sm btn flex-none ${on ? "bg-saffron text-white" : "border border-ink-200 bg-white text-ink-800 hover:bg-ink-50"}`}
      onClick={() => {
        stopSpeaking();
        if (on) return setPlaying(null);
        setPlaying(id);
        speak(text, lang, () => setPlaying(null));
      }}
      aria-pressed={on}
    >
      {on ? <Square size={14} /> : <Volume2 size={16} />}
      {on
        ? tr({ en: "Stop", hi: "रोकें", kn: "ನಿಲ್ಲಿಸಿ" })
        : tr({ en: "Listen", hi: "सुनें", kn: "ಕೇಳಿ" })}
    </button>
  );
}

function LanguagePills({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const tr = useTr();
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="radiogroup"
      aria-label={tr({ en: "Language", hi: "भाषा", kn: "ಭಾಷೆ" })}
    >
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={lang === l.code}
          onClick={() => setLang(l.code)}
          className={`min-h-[44px] rounded-full border font-semibold transition-colors ${
            compact ? "px-3 text-sm" : "px-4"
          } ${
            lang === l.code
              ? "border-ink-800 bg-ink-800 text-white"
              : "border-paper-300 text-ink-700 hover:border-ink-300"
          }`}
        >
          {l.native}
        </button>
      ))}
    </div>
  );
}

/* Sticky nav. NOTE: if your app already renders a shared header from a parent
   layout (App.tsx / Layout.tsx), move this into that component instead —
   otherwise the page will end up with two navbars stacked. I don't have
   visibility into the rest of the app, so it lives here for now. */
function Navbar() {
  const tr = useTr();
  const [open, setOpen] = useState(false);

  const links: { href: string; label: Tri }[] = [
    {
      href: "#how",
      label: {
        en: "How it works",
        hi: "कैसे काम करता है",
        kn: "ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
      },
    },
    {
      href: "#who",
      label: { en: "Who it's for", hi: "यह किसके लिए है", kn: "ಇದು ಯಾರಿಗಾಗಿ" },
    },
    {
      href: "#trust",
      label: {
        en: "Trust & safety",
        hi: "भरोसा और सुरक्षा",
        kn: "ನಂಬಿಕೆ ಮತ್ತು ಸುರಕ್ಷತೆ",
      },
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-paper-300 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-lg font-bold text-ink-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-800 text-white">
            <Mic size={18} />
          </span>
          Sahayak
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-ink-700 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-ink-900">
              {tr(l.label)}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguagePills compact />
          <Link to="/signin" className="btn-secondary btn-sm">
            {tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" })}
          </Link>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-paper-300 text-ink-800 md:hidden"
          aria-expanded={open}
          aria-label={tr({ en: "Menu", hi: "मेन्यू", kn: "ಮೆನು" })}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-paper-300 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1 text-ink-800">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="py-2 font-semibold"
                onClick={() => setOpen(false)}
              >
                {tr(l.label)}
              </a>
            ))}
          </nav>
          <div className="mt-3">
            <LanguagePills />
          </div>
          <Link
            to="/signin"
            className="btn-secondary btn-lg mt-4 flex w-full justify-center"
            onClick={() => setOpen(false)}
          >
            {tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" })}
          </Link>
        </div>
      )}
    </header>
  );
}

/* Interactive hero mockup: real, switchable example conversations rather than
   a static screenshot. Clicking a chip swaps the transcript and scheme card. */
function DemoMock() {
  const tr = useTr();
  const [active, setActive] = useState(0);
  const demo = DEMOS[active];

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-[32px] bg-gradient-to-br from-blue-100/70 via-white to-saffron/10 blur-2xl"
      />
      <div className="rounded-3xl border border-paper-300 bg-white/85 p-4 shadow-xl shadow-ink-900/5 backdrop-blur-xl sm:p-5">
        <p className="mb-2 text-sm font-medium text-ink-500">
          {tr({
            en: "See an example conversation:",
            hi: "एक उदाहरण देखें:",
            kn: "ಒಂದು ಉದಾಹರಣೆ ನೋಡಿ:",
          })}
        </p>
        <div className="flex flex-wrap gap-2 border-b border-paper-300 pb-3">
          {DEMOS.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                i === active
                  ? "bg-ink-800 text-white"
                  : "bg-paper-100 text-ink-700 hover:bg-paper-300"
              }`}
            >
              {tr(d.chip)}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-end justify-center gap-1.5" aria-hidden>
          {[7, 13, 20, 15, 24, 11, 18, 9].map((h, i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-saffron/70"
              style={{ height: h }}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <div className="flex max-w-[88%] items-start gap-2 rounded-2xl rounded-tr-sm bg-ink-800 px-4 py-2.5 text-white">
            <Mic size={15} className="mt-1 flex-none text-saffron" />
            {tr(demo.query)}
          </div>
        </div>

        <div className="mt-3 rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[0.95rem] text-ink-800">
          {demo.answer.map((line, i) => (
            <span key={i}>
              {tr(line)}
              <span className="cite">{i + 1}</span>{" "}
            </span>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-paper-300 bg-white p-3">
          <div className="font-semibold text-ink-900">
            {tr(demo.schemeName)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-leaf-700">
            <Landmark size={14} /> {tr(demo.schemeBenefit)}
          </div>
          <div className="mt-3 flex gap-2">
            <span className="btn-accent btn-sm">
              {tr({ en: "Apply", hi: "आवेदन करें", kn: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ" })}
            </span>
            <span className="btn-secondary btn-sm">
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
  );
}

function AudienceGrid() {
  const tr = useTr();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {AUDIENCES.map(({ icon: Icon, label }) => (
        <Link
          key={label.en}
          to="/assistant"
          className="group flex flex-col items-center gap-2 rounded-2xl border border-paper-300 bg-white p-4 text-center transition-colors hover:border-saffron-600 hover:bg-paper-100"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-paper-100 text-ink-800 transition-colors group-hover:bg-saffron/15 group-hover:text-saffron-700">
            <Icon size={20} />
          </span>
          <span className="text-sm font-semibold text-ink-800">
            {tr(label)}
          </span>
        </Link>
      ))}
    </div>
  );
}

/* NOTE: /privacy, /accessibility and /contact are placeholders — wire them up
   to real routes/pages, or swap them for whatever paths your app actually
   uses. I didn't add a "government verified" or "open source" badge here:
   your own copy elsewhere says this is a practice tool, not the official
   government site, and a verification badge would contradict that. */
function Footer() {
  const tr = useTr();
  return (
    <footer className="border-t border-paper-300 bg-paper-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-800 text-white">
              <Mic size={16} />
            </span>
            Sahayak
          </div>
          <p className="mt-3 max-w-sm text-sm text-ink-600">
            {tr({
              en: "Sahayak is an independent assistant that helps you find and apply for government schemes in your own language. It is not an official government website — always confirm final rules on the relevant government portal.",
              hi: "सहायक एक स्वतंत्र सहायक है जो आपको आपकी भाषा में सरकारी योजनाएँ खोजने और आवेदन करने में मदद करता है। यह कोई आधिकारिक सरकारी वेबसाइट नहीं है — अंतिम नियम हमेशा संबंधित सरकारी पोर्टल पर जाँचें।",
              kn: "ಸಹಾಯಕ ಒಂದು ಸ್ವತಂತ್ರ ಸಹಾಯಕ ಆಗಿದ್ದು, ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಲು ಮತ್ತು ಅರ್ಜಿ ಸಲ್ಲಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ. ಇದು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ವೆಬ್‌ಸೈಟ್ ಅಲ್ಲ — ಅಂತಿಮ ನಿಯಮಗಳನ್ನು ಯಾವಾಗಲೂ ಸಂಬಂಧಿತ ಸರ್ಕಾರಿ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಖಚಿತಪಡಿಸಿ.",
            })}
          </p>
          <div className="mt-4">
            <LanguagePills compact />
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-ink-900">
            {tr({ en: "Get started", hi: "शुरू करें", kn: "ಪ್ರಾರಂಭಿಸಿ" })}
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-700">
            <li>
              <Link to="/signup" className="hover:text-ink-900">
                {tr({
                  en: "Create an account",
                  hi: "खाता बनाएँ",
                  kn: "ಖಾತೆ ರಚಿಸಿ",
                })}
              </Link>
            </li>
            <li>
              <Link to="/signin" className="hover:text-ink-900">
                {tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" })}
              </Link>
            </li>
            <li>
              <Link to="/signin?demo=citizen" className="hover:text-ink-900">
                {tr({
                  en: "Try the demo",
                  hi: "डेमो आज़माएँ",
                  kn: "ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ",
                })}
              </Link>
            </li>
            <li>
              <a href="#how" className="hover:text-ink-900">
                {tr({
                  en: "How it works",
                  hi: "कैसे काम करता है",
                  kn: "ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
                })}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-ink-900">
            {tr({ en: "Policies", hi: "नीतियाँ", kn: "ನೀತಿಗಳು" })}
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-700">
            <li>
              <Link to="/privacy" className="hover:text-ink-900">
                {tr({
                  en: "Privacy policy",
                  hi: "गोपनीयता नीति",
                  kn: "ಗೌಪ್ಯತಾ ನೀತಿ",
                })}
              </Link>
            </li>
            <li>
              <Link to="/accessibility" className="hover:text-ink-900">
                {tr({
                  en: "Accessibility statement",
                  hi: "सुगमता कथन",
                  kn: "ಪ್ರವೇಶಸಾಧ್ಯತಾ ಹೇಳಿಕೆ",
                })}
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-ink-900">
                {tr({
                  en: "Contact us",
                  hi: "संपर्क करें",
                  kn: "ಸಂಪರ್ಕಿಸಿ",
                })}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-paper-300 px-4 py-4 text-center text-xs text-ink-500 sm:px-6">
        {tr({
          en: `© ${new Date().getFullYear()} Sahayak. Built to help, not to replace official government sources.`,
          hi: `© ${new Date().getFullYear()} सहायक। मदद के लिए बनाया गया, आधिकारिक सरकारी स्रोतों का विकल्प नहीं।`,
          kn: `© ${new Date().getFullYear()} ಸಹಾಯಕ. ಸಹಾಯಕ್ಕಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ, ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಮೂಲಗಳ ಬದಲಿಯಲ್ಲ.`,
        })}
      </div>
    </footer>
  );
}

/* ---------- Page ---------- */

export default function Landing() {
  const tr = useTr();
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => stopSpeaking(), []);

  let n = 0; // running step number across phases

  return (
    <div>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-white"
      >
        {tr({
          en: "Skip to main content",
          hi: "मुख्य सामग्री पर जाएँ",
          kn: "ಮುಖ್ಯ ವಿಷಯಕ್ಕೆ ಹೋಗಿ",
        })}
      </a>

      <Navbar />

      <main id="main">
        {/* Hero: what it is, pick a language, start. */}
        <section className="relative overflow-hidden border-b border-paper-300 bg-gradient-to-b from-blue-50/50 via-white to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_460px] lg:gap-14 lg:py-24">
            <div>
              <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
                {tr({
                  en: "Government help, in your own language.",
                  hi: "सरकारी मदद, आपकी अपनी भाषा में।",
                  kn: "ಸರ್ಕಾರಿ ಸಹಾಯ, ನಿಮ್ಮದೇ ಭಾಷೆಯಲ್ಲಿ.",
                })}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600 sm:text-xl">
                {tr({
                  en: "Speak about your problem. Sahayak finds the schemes that can help you and fills the form with you, step by step.",
                  hi: "अपनी समस्या बोलकर बताइए। सहायक आपकी मदद करने वाली योजनाएँ खोजता है और कदम-दर-कदम आपके साथ फ़ॉर्म भरता है।",
                  kn: "ನಿಮ್ಮ ಸಮಸ್ಯೆಯನ್ನು ಮಾತಿನಲ್ಲಿ ಹೇಳಿ. ಸಹಾಯಕ ನಿಮಗೆ ಸಹಾಯ ಮಾಡುವ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕುತ್ತದೆ ಮತ್ತು ಹಂತ ಹಂತವಾಗಿ ನಿಮ್ಮೊಂದಿಗೆ ಫಾರ್ಮ್ ತುಂಬುತ್ತದೆ.",
                })}
              </p>

              <div className="mt-8">
                <p className="mb-2 text-sm font-medium text-ink-500">
                  {tr({
                    en: "Choose your language",
                    hi: "अपनी भाषा चुनिए",
                    kn: "ನಿಮ್ಮ ಭಾಷೆ ಆರಿಸಿ",
                  })}
                </p>
                <LanguagePills />
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  to="/signup"
                  className="btn-accent btn-lg gap-2 rounded-full shadow-lg shadow-saffron/25"
                >
                  <Mic size={18} />
                  {tr({
                    en: "Start speaking",
                    hi: "बोलना शुरू करें",
                    kn: "ಮಾತನಾಡಲು ಪ್ರಾರಂಭಿಸಿ",
                  })}
                </Link>
                <Link
                  to="/signin"
                  className="btn-secondary btn-lg rounded-full"
                >
                  {tr({
                    en: "Continue an application",
                    hi: "आवेदन जारी रखें",
                    kn: "ಅರ್ಜಿ ಮುಂದುವರಿಸಿ",
                  })}
                </Link>
              </div>

              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink-600">
                <li className="flex items-center gap-1.5">
                  <Volume2 size={16} className="text-leaf-700" />
                  {tr({
                    en: "Voice available in every step",
                    hi: "हर कदम पर आवाज़ उपलब्ध",
                    kn: "ಪ್ರತಿ ಹಂತದಲ್ಲಿ ಧ್ವನಿ ಲಭ್ಯ",
                  })}
                </li>
                {PROMISES.map(({ icon: Icon, text }) => (
                  <li key={text.en} className="flex items-center gap-1.5">
                    <Icon size={16} className="text-leaf-700" />
                    {tr(text)}
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-ink-600">
                {tr({
                  en: "Just want to look around?",
                  hi: "बस देखना चाहते हैं?",
                  kn: "ಸುಮ್ಮನೆ ನೋಡಬೇಕೆ?",
                })}{" "}
                <Link
                  to="/signin?demo=citizen"
                  className="font-semibold text-ink-900 underline underline-offset-4 hover:text-saffron-700"
                >
                  {tr({
                    en: "Try the demo as Ramesh, a farmer",
                    hi: "किसान रमेश बनकर डेमो आज़माएँ",
                    kn: "ರೈತ ರಮೇಶ್ ಆಗಿ ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ",
                  })}
                </Link>
                {". "}
                {tr({
                  en: "Nothing is sent to the government.",
                  hi: "कुछ भी सरकार को नहीं भेजा जाता।",
                  kn: "ಏನೂ ಸರ್ಕಾರಕ್ಕೆ ಹೋಗುವುದಿಲ್ಲ.",
                })}
              </p>
            </div>

            <DemoMock />
          </div>
        </section>

        {/* Quick overview: the same three-phase idea from "How to use", shown
            as scannable cards before the full detail below. */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {OVERVIEW.map(({ icon: Icon, title, text }, i) => (
              <div
                key={title.en}
                className="rounded-3xl border border-paper-300 bg-white p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <Icon size={22} className="text-saffron-600" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink-900">
                  {tr(title)}
                </h3>
                <p className="mt-1.5 text-ink-600">{tr(text)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Who it's for. */}
        <section id="who" className="border-t border-paper-300 bg-paper-100">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold text-ink-900 sm:text-3xl">
                {tr({
                  en: "Who Sahayak can help",
                  hi: "सहायक किसकी मदद कर सकता है",
                  kn: "ಸಹಾಯಕ ಯಾರಿಗೆ ಸಹಾಯ ಮಾಡಬಹುದು",
                })}
              </h2>
              <p className="mt-2 text-ink-600">
                {tr({
                  en: "Tap a group to start talking to the assistant about schemes that may apply to you.",
                  hi: "आपसे जुड़ी योजनाओं के बारे में सहायक से बात शुरू करने के लिए किसी समूह पर दबाइए।",
                  kn: "ನಿಮಗೆ ಸಂಬಂಧಿಸಿದ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಸಹಾಯಕರೊಂದಿಗೆ ಮಾತನಾಡಲು ಒಂದು ಗುಂಪನ್ನು ಒತ್ತಿ.",
                })}
              </p>
            </div>
            <div className="mt-8">
              <AudienceGrid />
            </div>
          </div>
        </section>

        {/* How to use: the steps, with what to keep ready and safety alongside. */}
        <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold text-ink-900 sm:text-3xl">
              {tr({
                en: "How to use Sahayak",
                hi: "सहायक का इस्तेमाल कैसे करें",
                kn: "ಸಹಾಯಕ ಬಳಸುವುದು ಹೇಗೆ",
              })}
            </h2>
            <p className="mt-2 text-ink-600">
              {tr({
                en: "Follow these steps one by one. Tap “Listen” on any step to hear it read aloud.",
                hi: "ये कदम एक-एक करके अपनाइए। किसी भी कदम को सुनने के लिए “सुनें” दबाइए।",
                kn: "ಈ ಹಂತಗಳನ್ನು ಒಂದೊಂದಾಗಿ ಅನುಸರಿಸಿ. ಯಾವುದೇ ಹಂತವನ್ನು ಕೇಳಲು “ಕೇಳಿ” ಒತ್ತಿ.",
              })}
            </p>
          </div>

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_320px]">
            {/* Steps, grouped so nine steps read as three stages. */}
            <div className="space-y-6">
              {PHASES.map((phase) => (
                <div key={phase.title.en} className="card overflow-hidden">
                  <h3 className="border-b border-paper-300 bg-paper-100 px-5 py-3 font-bold text-ink-900">
                    {tr(phase.title)}
                  </h3>
                  <ol className="divide-y divide-paper-300">
                    {phase.steps.map(({ title, text, tip }) => {
                      n += 1;
                      const num = n;
                      return (
                        <li
                          key={title.en}
                          className="flex gap-4 px-5 py-4"
                          value={num}
                        >
                          <span
                            className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink-800 text-sm font-bold text-white"
                            aria-hidden
                          >
                            {num}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                              <h4 className="pt-0.5 text-lg font-bold text-ink-900">
                                <span className="sr-only">{num}. </span>
                                {tr(title)}
                              </h4>
                              <ListenButton
                                id={title.en}
                                text={`${tr(title)}. ${tr(text)}${tip ? " " + tr(tip) : ""}`}
                                playing={playing}
                                setPlaying={setPlaying}
                              />
                            </div>
                            <p className="mt-1 leading-relaxed text-ink-700">
                              {tr(text)}
                            </p>
                            {tip && (
                              <p className="mt-2 border-l-4 border-saffron pl-3 italic text-ink-700">
                                {tr(tip)}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>

            {/* Side panel. Shows before the steps on phones, beside them on desktop. */}
            <aside className="order-first space-y-6 lg:sticky lg:top-6 lg:order-none">
              <section className="card p-5" aria-labelledby="need">
                <h3 id="need" className="font-bold text-ink-900">
                  {tr({
                    en: "Keep these ready",
                    hi: "ये चीज़ें पास रखिए",
                    kn: "ಇವುಗಳನ್ನು ಸಿದ್ಧವಾಗಿಡಿ",
                  })}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {NEED.map(({ icon: Icon, text }) => (
                    <li
                      key={text.en}
                      className="flex items-start gap-3 text-ink-800"
                    >
                      <Icon
                        size={18}
                        className="mt-0.5 flex-none text-saffron-600"
                      />
                      {tr(text)}
                    </li>
                  ))}
                </ul>
              </section>

              <section
                className="rounded-2xl border border-brick-100 bg-brick-50 p-5"
                aria-labelledby="safe"
              >
                <h3
                  id="safe"
                  className="flex items-center gap-2 font-bold text-brick"
                >
                  <ShieldAlert size={20} />
                  {tr({
                    en: "Stay safe",
                    hi: "सुरक्षित रहिए",
                    kn: "ಸುರಕ್ಷಿತವಾಗಿರಿ",
                  })}
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-800 marker:text-brick">
                  <li>
                    {tr({
                      en: "Never say or type an OTP, PIN or password. Sahayak will never ask for one.",
                      hi: "OTP, PIN या पासवर्ड कभी न बोलें या लिखें। सहायक कभी नहीं माँगेगा।",
                      kn: "OTP, PIN ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಎಂದಿಗೂ ಹೇಳಬೇಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಬೇಡಿ. ಸಹಾಯಕ ಎಂದಿಗೂ ಕೇಳುವುದಿಲ್ಲ.",
                    })}
                  </li>
                  <li>
                    {tr({
                      en: "Always read the answer before saying “yes”.",
                      hi: "“हाँ” कहने से पहले हमेशा जवाब पढ़िए।",
                      kn: "“ಹೌದು” ಎನ್ನುವ ಮೊದಲು ಯಾವಾಗಲೂ ಉತ್ತರ ಓದಿ.",
                    })}
                  </li>
                  <li>
                    {tr({
                      en: "This is a practice version. Confirm rules on the official government website.",
                      hi: "यह अभ्यास संस्करण है। नियम सरकारी वेबसाइट पर ज़रूर जाँचें।",
                      kn: "ಇದು ಅಭ್ಯಾಸ ಆವೃತ್ತಿ. ನಿಯಮಗಳನ್ನು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಖಚಿತಪಡಿಸಿ.",
                    })}
                  </li>
                </ul>
              </section>

              <section className="card p-5" aria-labelledby="words">
                <h3 id="words" className="font-bold text-ink-900">
                  {tr({
                    en: "Words you may see",
                    hi: "शब्द जो आपको दिख सकते हैं",
                    kn: "ನೀವು ನೋಡಬಹುದಾದ ಪದಗಳು",
                  })}
                </h3>
                <div className="mt-2 divide-y divide-paper-300">
                  {WORDS.map(({ word, meaning }) => (
                    <details key={word.en} className="group py-2">
                      <summary className="flex min-h-[40px] cursor-pointer list-none items-center justify-between font-semibold text-ink-800 [&::-webkit-details-marker]:hidden">
                        {tr(word)}
                        <span
                          className="text-ink-400 transition-transform group-open:rotate-45"
                          aria-hidden
                        >
                          +
                        </span>
                      </summary>
                      <p className="pb-1 text-ink-600">{tr(meaning)}</p>
                    </details>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>

        {/* Trust & privacy. */}
        <section id="trust" className="border-t border-paper-300 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold text-ink-900 sm:text-3xl">
                {tr({
                  en: "Built to be trusted",
                  hi: "भरोसे के लिए बनाया गया",
                  kn: "ನಂಬಿಕೆಗಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ",
                })}
              </h2>
              <p className="mt-2 text-ink-600">
                {tr({
                  en: "You are always in control of what gets shared and submitted.",
                  hi: "क्या साझा और सबमिट होगा, यह हमेशा आपके हाथ में है।",
                  kn: "ಏನನ್ನು ಹಂಚಿಕೊಳ್ಳಲಾಗುತ್ತದೆ ಮತ್ತು ಸಲ್ಲಿಸಲಾಗುತ್ತದೆ ಎಂಬುದು ಯಾವಾಗಲೂ ನಿಮ್ಮ ಕೈಯಲ್ಲಿ.",
                })}
              </p>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {TRUST_CARDS.map(({ icon: Icon, title, text }) => (
                <div
                  key={title.en}
                  className="rounded-3xl border border-paper-300 bg-paper-100/60 p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-leaf-700 shadow-sm">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 font-bold text-ink-900">{tr(title)}</h3>
                  <p className="mt-1.5 text-ink-600">{tr(text)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Close */}
        <section className="border-t border-paper-300 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
            <p className="text-lg font-semibold text-ink-900">
              {tr({
                en: "Ready? Let's begin.",
                hi: "तैयार हैं? चलिए शुरू करें।",
                kn: "ಸಿದ್ಧರಿದ್ದೀರಾ? ಪ್ರಾರಂಭಿಸೋಣ.",
              })}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/assistant" className="btn-accent btn-lg rounded-full">
                <Mic size={20} />
                {tr({
                  en: "Talk to the assistant",
                  hi: "सहायक से बात करें",
                  kn: "ಸಹಾಯಕರೊಂದಿಗೆ ಮಾತನಾಡಿ",
                })}
              </Link>
              <Link
                to="/signin?demo=citizen"
                className="btn-secondary btn-lg rounded-full"
              >
                {tr({
                  en: "Try the demo",
                  hi: "डेमो आज़माएँ",
                  kn: "ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ",
                })}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
