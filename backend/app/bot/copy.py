"""Shared multilingual copy for Telegram and WhatsApp."""

LANGS = ("en", "hi", "kn")
LANG_LABELS = {"en": "English 🇬🇧", "hi": "हिन्दी 🇮🇳", "kn": "ಕನ್ನಡ 🇮🇳"}

WELCOME = {
    "en": (
        "👋 *Welcome to Sahayak!*\n\n"
        "I help you find Indian government schemes that fit your situation.\n\n"
        "Describe what happened in your own words, for example:\n"
        "_\"Heavy rain destroyed my crop.\"_\n\n"
        "You can also ask:\n"
        "• _What documents do I need for PM-KISAN?_\n"
        "• _How much money does PM-KISAN give?_\n"
        "• _How do I claim crop insurance?_\n\n"
        "Every answer is grounded in official sources — tap *Sources* to read them.\n"
        "Send *language* to switch language · *new* to start over · *help* for more."
    ),
    "hi": (
        "👋 *सहायक में आपका स्वागत है!*\n\n"
        "मैं आपकी स्थिति के अनुसार सरकारी योजनाएँ खोजने में मदद करता हूँ।\n\n"
        "अपने शब्दों में बताइए क्या हुआ, जैसे:\n"
        "_\"भारी बारिश से मेरी फसल नष्ट हो गई।\"_\n\n"
        "आप यह भी पूछ सकते हैं:\n"
        "• _PM-KISAN के लिए कौन से दस्तावेज़ चाहिए?_\n"
        "• _फसल बीमा का दावा कैसे करें?_\n\n"
        "हर उत्तर आधिकारिक स्रोतों पर आधारित है — *स्रोत* पर टैप करें।\n"
        "*language* भाषा बदलें · *new* नई बातचीत · *help* मदद"
    ),
    "kn": (
        "👋 *ಸಹಾಯಕಕ್ಕೆ ಸ್ವಾಗತ!*\n\n"
        "ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಗೆ ಹೊಂದುವ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.\n\n"
        "ಏನಾಯಿತು ಎಂದು ನಿಮ್ಮ ಮಾತುಗಳಲ್ಲಿ ಹೇಳಿ, ಉದಾಹರಣೆ:\n"
        "_\"ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ನಾಶವಾಯಿತು.\"_\n\n"
        "ನೀವು ಇದನ್ನೂ ಕೇಳಬಹುದು:\n"
        "• _PM-KISAN ಗೆ ಯಾವ ದಾಖಲೆಗಳು ಬೇಕು?_\n"
        "• _ಬೆಳೆ ವಿಮೆ ಕ್ಲೈಮ್ ಹೇಗೆ ಮಾಡುವುದು?_\n\n"
        "ಪ್ರತಿ ಉತ್ತರ ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ಆಧರಿಸಿದೆ — *ಮೂಲಗಳು* ಟ್ಯಾಪ್ ಮಾಡಿ.\n"
        "*language* ಭಾಷೆ · *new* ಹೊಸ ಸಂಭಾಷಣೆ · *help* ಸಹಾಯ"
    ),
}

# Telegram uses HTML; WhatsApp uses the markdown versions above. Telegram welcome is HTML.
WELCOME_HTML = {
    "en": (
        "👋 <b>Welcome to Sahayak!</b>\n\n"
        "I help you find Indian government schemes that fit your situation.\n\n"
        "Describe what happened in your own words, for example:\n"
        "<i>\"Heavy rain destroyed my crop.\"</i>\n\n"
        "You can also ask:\n"
        "• <i>What documents do I need for PM-KISAN?</i>\n"
        "• <i>How much money does PM-KISAN give?</i>\n"
        "• <i>How do I claim crop insurance?</i>\n\n"
        "Every answer is grounded in official sources — tap <b>📚 Sources</b> to read them.\n"
        "/language to switch language · /new to start over · /help for more."
    ),
    "hi": (
        "👋 <b>सहायक में आपका स्वागत है!</b>\n\n"
        "मैं आपकी स्थिति के अनुसार सरकारी योजनाएँ खोजने में मदद करता हूँ।\n\n"
        "अपने शब्दों में बताइए क्या हुआ, जैसे:\n"
        "<i>\"भारी बारिश से मेरी फसल नष्ट हो गई।\"</i>\n\n"
        "आप यह भी पूछ सकते हैं:\n"
        "• <i>PM-KISAN के लिए कौन से दस्तावेज़ चाहिए?</i>\n"
        "• <i>फसल बीमा का दावा कैसे करें?</i>\n\n"
        "हर उत्तर आधिकारिक स्रोतों पर आधारित है — <b>📚 स्रोत</b> पर टैप करें।\n"
        "/language भाषा बदलें · /new नई बातचीत · /help मदद"
    ),
    "kn": (
        "👋 <b>ಸಹಾಯಕಕ್ಕೆ ಸ್ವಾಗತ!</b>\n\n"
        "ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಗೆ ಹೊಂದುವ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.\n\n"
        "ಏನಾಯಿತು ಎಂದು ನಿಮ್ಮ ಮಾತುಗಳಲ್ಲಿ ಹೇಳಿ, ಉದಾಹರಣೆ:\n"
        "<i>\"ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ನಾಶವಾಯಿತು.\"</i>\n\n"
        "ನೀವು ಇದನ್ನೂ ಕೇಳಬಹುದು:\n"
        "• <i>PM-KISAN ಗೆ ಯಾವ ದಾಖಲೆಗಳು ಬೇಕು?</i>\n"
        "• <i>ಬೆಳೆ ವಿಮೆ ಕ್ಲೈಮ್ ಹೇಗೆ ಮಾಡುವುದು?</i>\n\n"
        "ಪ್ರತಿ ಉತ್ತರ ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ಆಧರಿಸಿದೆ — <b>📚 ಮೂಲಗಳು</b> ಟ್ಯಾಪ್ ಮಾಡಿ.\n"
        "/language ಭಾಷೆ · /new ಹೊಸ ಸಂಭಾಷಣೆ · /help ಸಹಾಯ"
    ),
}

HELP_TEXT = {
    "en": (
        "ℹ️ *How to use Sahayak*\n\n"
        "Describe your situation or ask a question in English, Hindi or Kannada. "
        "I remember the last few messages, so you can ask follow-ups like _\"how do I apply for it?\"_\n\n"
        "Tap a scheme under an answer to see its documents, eligibility, benefit and how to apply.\n\n"
        "*Commands*\n"
        "start — welcome message\n"
        "help — this help\n"
        "language — change language\n"
        "new — start a new conversation\n"
        "sources — sources behind the last answer\n\n"
        "*Note:* answers come from official sources, but always confirm eligibility with the department before you apply."
    ),
    "hi": (
        "ℹ️ *सहायक का उपयोग कैसे करें*\n\n"
        "अपनी स्थिति बताइए या हिन्दी, अंग्रेज़ी या कन्नड़ में सवाल पूछिए। मुझे पिछले कुछ संदेश याद रहते हैं, "
        "इसलिए आप पूछ सकते हैं _\"इसके लिए आवेदन कैसे करें?\"_\n\n"
        "किसी उत्तर के नीचे योजना पर टैप करके दस्तावेज़, पात्रता, लाभ और आवेदन का तरीका देखें।\n\n"
        "*कमांड*\n"
        "start — स्वागत संदेश\nhelp — मदद\nlanguage — भाषा बदलें\nnew — नई बातचीत\nsources — पिछले उत्तर के स्रोत"
    ),
    "kn": (
        "ℹ️ *ಸಹಾಯಕ ಬಳಕೆ*\n\n"
        "ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿ ವಿವರಿಸಿ ಅಥವಾ ಕನ್ನಡ, ಹಿಂದಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಪ್ರಶ್ನೆ ಕೇಳಿ. ಕೊನೆಯ ಕೆಲವು ಸಂದೇಶಗಳು ನನಗೆ ನೆನಪಿರುತ್ತವೆ, "
        "ಆದ್ದರಿಂದ _\"ಇದಕ್ಕೆ ಅರ್ಜಿ ಹೇಗೆ?\"_ ಎಂದು ಕೇಳಬಹುದು.\n\n"
        "ಉತ್ತರದ ಕೆಳಗಿನ ಯೋಜನೆ ಟ್ಯಾಪ್ ಮಾಡಿ ದಾಖಲೆಗಳು, ಅರ್ಹತೆ, ಪ್ರಯೋಜನ ಮತ್ತು ಅರ್ಜಿ ವಿಧಾನ ನೋಡಿ.\n\n"
        "*ಆದೇಶಗಳು*\n"
        "start — ಸ್ವಾಗತ\nhelp — ಸಹಾಯ\nlanguage — ಭಾಷೆ ಬದಲಿಸಿ\nnew — ಹೊಸ ಸಂಭಾಷಣೆ\nsources — ಹಿಂದಿನ ಉತ್ತರದ ಮೂಲಗಳು"
    ),
}

HELP_HTML = {
    "en": (
        "ℹ️ <b>How to use Sahayak</b>\n\n"
        "Describe your situation or ask a question in English, Hindi or Kannada. "
        "I remember the last few messages, so you can ask follow-ups like <i>\"how do I apply for it?\"</i>\n\n"
        "Tap a scheme button under an answer to see its documents, eligibility, benefit and how to apply.\n\n"
        "<b>Commands</b>\n"
        "/start — welcome message\n"
        "/help — this help\n"
        "/language — change language\n"
        "/new — start a new conversation\n"
        "/sources — sources behind the last answer\n\n"
        "<b>Note:</b> answers come from official sources, but always confirm eligibility with the department before you apply."
    ),
    "hi": (
        "ℹ️ <b>सहायक का उपयोग कैसे करें</b>\n\n"
        "अपनी स्थिति बताइए या हिन्दी, अंग्रेज़ी या कन्नड़ में सवाल पूछिए। मुझे पिछले कुछ संदेश याद रहते हैं, "
        "इसलिए आप पूछ सकते हैं <i>\"इसके लिए आवेदन कैसे करें?\"</i>\n\n"
        "किसी उत्तर के नीचे योजना बटन पर टैप करके दस्तावेज़, पात्रता, लाभ और आवेदन का तरीका देखें।\n\n"
        "<b>कमांड</b>\n"
        "/start — स्वागत संदेश\n/help — मदद\n/language — भाषा बदलें\n/new — नई बातचीत\n/sources — पिछले उत्तर के स्रोत"
    ),
    "kn": (
        "ℹ️ <b>ಸಹಾಯಕ ಬಳಕೆ</b>\n\n"
        "ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿ ವಿವರಿಸಿ ಅಥವಾ ಕನ್ನಡ, ಹಿಂದಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಪ್ರಶ್ನೆ ಕೇಳಿ. ಕೊನೆಯ ಕೆಲವು ಸಂದೇಶಗಳು ನನಗೆ ನೆನಪಿರುತ್ತವೆ, "
        "ಆದ್ದರಿಂದ <i>\"ಇದಕ್ಕೆ ಅರ್ಜಿ ಹೇಗೆ?\"</i> ಎಂದು ಕೇಳಬಹುದು.\n\n"
        "ಉತ್ತರದ ಕೆಳಗಿನ ಯೋಜನೆ ಬಟನ್ ಟ್ಯಾಪ್ ಮಾಡಿ ದಾಖಲೆಗಳು, ಅರ್ಹತೆ, ಪ್ರಯೋಜನ ಮತ್ತು ಅರ್ಜಿ ವಿಧಾನ ನೋಡಿ.\n\n"
        "<b>ಆದೇಶಗಳು</b>\n"
        "/start — ಸ್ವಾಗತ\n/help — ಸಹಾಯ\n/language — ಭಾಷೆ ಬದಲಿಸಿ\n/new — ಹೊಸ ಸಂಭಾಷಣೆ\n/sources — ಹಿಂದಿನ ಉತ್ತರದ ಮೂಲಗಳು"
    ),
}

UI = {
    "error": {
        "en": "😔 Sorry, something went wrong while answering. Please try again in a moment.",
        "hi": "😔 क्षमा करें, उत्तर देते समय कुछ गड़बड़ हो गई। कृपया थोड़ी देर बाद फिर कोशिश करें।",
        "kn": "😔 ಕ್ಷಮಿಸಿ, ಉತ್ತರಿಸುವಾಗ ತೊಂದರೆಯಾಯಿತು. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    },
    "text_only": {
        "en": "I can only read text messages for now. Please type your question.",
        "hi": "अभी मैं केवल लिखे हुए संदेश पढ़ सकता हूँ। कृपया अपना सवाल लिखें।",
        "kn": "ಸದ್ಯ ನಾನು ಬರಹದ ಸಂದೇಶಗಳನ್ನು ಮಾತ್ರ ಓದಬಲ್ಲೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ.",
    },
    "too_long": {
        "en": "That message is very long. Please describe your question in a few sentences.",
        "hi": "संदेश बहुत लंबा है। कृपया अपना सवाल कुछ वाक्यों में लिखें।",
        "kn": "ಸಂದೇಶ ತುಂಬಾ ಉದ್ದವಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಕೆಲವು ವಾಕ್ಯಗಳಲ್ಲಿ ಬರೆಯಿರಿ.",
    },
    "new_chat": {
        "en": "🆕 Started a new conversation. Tell me what happened or ask about a scheme.",
        "hi": "🆕 नई बातचीत शुरू हुई। बताइए क्या हुआ या किसी योजना के बारे में पूछिए।",
        "kn": "🆕 ಹೊಸ ಸಂಭಾಷಣೆ ಆರಂಭವಾಯಿತು. ಏನಾಯಿತು ಎಂದು ಹೇಳಿ ಅಥವಾ ಯೋಜನೆಯ ಬಗ್ಗೆ ಕೇಳಿ.",
    },
    "no_sources": {
        "en": "There are no sources yet. Ask me a question first.",
        "hi": "अभी कोई स्रोत नहीं है। पहले कोई सवाल पूछिए।",
        "kn": "ಇನ್ನೂ ಯಾವುದೇ ಮೂಲಗಳಿಲ್ಲ. ಮೊದಲು ಪ್ರಶ್ನೆ ಕೇಳಿ.",
    },
    "lang_set": {"en": "✅ Language set to {label}", "hi": "✅ भाषा {label} चुनी गई", "kn": "✅ ಭಾಷೆ {label} ಆಯ್ಕೆಯಾಗಿದೆ"},
    "choose_lang": {
        "en": "Choose your language / भाषा चुनें / ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ:",
        "hi": "Choose your language / भाषा चुनें / ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ:",
        "kn": "Choose your language / भाषा चुनें / ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ:",
    },
    "scheme_missing": {
        "en": "I couldn't find that scheme any more. Please ask your question again.",
        "hi": "यह योजना अब नहीं मिली। कृपया अपना सवाल फिर से पूछें।",
        "kn": "ಆ ಯೋಜನೆ ಈಗ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆಯನ್ನು ಮತ್ತೆ ಕೇಳಿ.",
    },
    "benefit": {"en": "Benefit", "hi": "लाभ", "kn": "ಪ್ರಯೋಜನ"},
    "department": {"en": "Department", "hi": "विभाग", "kn": "ಇಲಾಖೆ"},
    "portal": {"en": "Apply at", "hi": "आवेदन", "kn": "ಅರ್ಜಿ"},
    "scheme_hint": {
        "en": "What would you like to know?",
        "hi": "आप क्या जानना चाहेंगे?",
        "kn": "ನೀವು ಏನು ತಿಳಿಯಲು ಬಯಸುತ್ತೀರಿ?",
    },
    "demo": {
        "en": "DEMO summary — confirm on the official portal.",
        "hi": "डेमो सारांश — आधिकारिक पोर्टल पर पुष्टि करें।",
        "kn": "ಡೆಮೊ ಸಾರಾಂಶ — ಅಧಿಕೃತ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ದೃಢೀಕರಿಸಿ.",
    },
    "options": {"en": "Options", "hi": "विकल्प", "kn": "ಆಯ್ಕೆಗಳು"},
    "schemes": {"en": "Schemes", "hi": "योजनाएँ", "kn": "ಯೋಜನೆಗಳು"},
    "sources_btn": {"en": "📚 Sources ({n})", "hi": "📚 स्रोत ({n})", "kn": "📚 ಮೂಲಗಳು ({n})"},
}

ASK = {
    "documents": {
        "en": "What documents do I need for {name}?",
        "hi": "{name} के लिए कौन से दस्तावेज़ चाहिए?",
        "kn": "{name} ಗೆ ಯಾವ ದಾಖಲೆಗಳು ಬೇಕು?",
    },
    "eligibility": {
        "en": "Who is eligible for {name}?",
        "hi": "{name} के लिए कौन पात्र है?",
        "kn": "{name} ಗೆ ಯಾರು ಅರ್ಹರು?",
    },
    "how_to_apply": {
        "en": "How do I apply for {name}?",
        "hi": "{name} के लिए आवेदन कैसे करें?",
        "kn": "{name} ಗೆ ಅರ್ಜಿ ಹೇಗೆ ಸಲ್ಲಿಸುವುದು?",
    },
    "amount": {
        "en": "How much money will I get under {name}?",
        "hi": "{name} में कितना पैसा मिलेगा?",
        "kn": "{name} ಅಡಿಯಲ್ಲಿ ಎಷ್ಟು ಹಣ ಸಿಗುತ್ತದೆ?",
    },
}

BUTTONS = {
    "evidence": {"en": "📚 Sources ({n})", "hi": "📚 स्रोत ({n})", "kn": "📚 ಮೂಲಗಳು ({n})"},
    "documents": {"en": "📄 Documents", "hi": "📄 दस्तावेज़", "kn": "📄 ದಾಖಲೆಗಳು"},
    "eligibility": {"en": "✅ Eligibility", "hi": "✅ पात्रता", "kn": "✅ ಅರ್ಹತೆ"},
    "how_to_apply": {"en": "📝 How to apply", "hi": "📝 आवेदन कैसे करें", "kn": "📝 ಅರ್ಜಿ ಹೇಗೆ"},
    "amount": {"en": "💰 Benefit", "hi": "💰 लाभ", "kn": "💰 ಪ್ರಯೋಜನ"},
}


def ui(key: str, lang: str, **kw) -> str:
    entry = UI[key]
    s = entry.get(lang) or entry["en"]
    return s.format(**kw) if kw else s


def button_label(key: str, lang: str, **kw) -> str:
    entry = BUTTONS[key]
    return (entry.get(lang) or entry["en"]).format(**kw)
