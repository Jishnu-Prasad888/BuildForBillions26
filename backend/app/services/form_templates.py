"""Localized phrases for the screen-aware form assistant (en / hi / kn)."""

F = {
    "greet_new": {
        "en": "I can see the **{form}** on your screen. It has {sections} sections and {fields} fields — {required} are required. I'll guide you one field at a time. You can speak or type.",
        "hi": "मैं आपकी स्क्रीन पर **{form}** देख सकता हूँ। इसमें {sections} भाग और {fields} फ़ील्ड हैं — {required} ज़रूरी हैं। मैं एक-एक फ़ील्ड में आपकी मदद करूँगा। आप बोलकर या लिखकर जवाब दे सकते हैं।",
        "kn": "ನಿಮ್ಮ ಪರದೆಯಲ್ಲಿ **{form}** ಕಾಣುತ್ತಿದೆ. ಇದರಲ್ಲಿ {sections} ವಿಭಾಗಗಳು ಮತ್ತು {fields} ಕ್ಷೇತ್ರಗಳಿವೆ — {required} ಕಡ್ಡಾಯ. ನಾನು ಒಂದೊಂದೇ ಕ್ಷೇತ್ರದಲ್ಲಿ ನಿಮಗೆ ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತೇನೆ. ನೀವು ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ ಉತ್ತರಿಸಬಹುದು.",
    },
    "greet_resume": {
        "en": "Welcome back. You were filling the **{form}** ({progress}% done). We completed your **{last}**. The next section requires your **{next}**.",
        "hi": "फिर से स्वागत है। आप **{form}** भर रहे थे ({progress}% पूरा)। हमने आपकी **{last}** पूरी कर ली है। अगले भाग में आपकी **{next}** चाहिए।",
        "kn": "ಮರಳಿ ಸ್ವಾಗತ. ನೀವು **{form}** ತುಂಬುತ್ತಿದ್ದಿರಿ ({progress}% ಪೂರ್ಣ). ನಾವು ನಿಮ್ಮ **{last}** ಪೂರ್ಣಗೊಳಿಸಿದ್ದೇವೆ. ಮುಂದಿನ ವಿಭಾಗಕ್ಕೆ ನಿಮ್ಮ **{next}** ಬೇಕು.",
    },
    "screen_seen": {
        "en": "I detected {n} fields on the visible part of your screen.",
        "hi": "आपकी स्क्रीन के दिखाई देने वाले भाग में मुझे {n} फ़ील्ड मिले।",
        "kn": "ನಿಮ್ಮ ಪರದೆಯ ಕಾಣುವ ಭಾಗದಲ್ಲಿ {n} ಕ್ಷೇತ್ರಗಳನ್ನು ಗುರುತಿಸಿದ್ದೇನೆ.",
    },
    "ask_label": {"en": "Next: **{label}**.", "hi": "अगला: **{label}**।", "kn": "ಮುಂದಿನದು: **{label}**."},
    "ask_text": {"en": "Next: **{label}**. {hint}What should I enter?", "hi": "अगला: **{label}**। {hint}मैं क्या भरूँ?", "kn": "ಮುಂದಿನದು: **{label}**. {hint}ನಾನು ಏನು ತುಂಬಲಿ?"},
    "ask_select": {
        "en": "Next: **{label}**. {hint}The options are: {options}. Which one applies to you?",
        "hi": "अगला: **{label}**। {hint}विकल्प हैं: {options}। आपके लिए कौन-सा सही है?",
        "kn": "ಮುಂದಿನದು: **{label}**. {hint}ಆಯ್ಕೆಗಳು: {options}. ನಿಮಗೆ ಯಾವುದು ಅನ್ವಯಿಸುತ್ತದೆ?",
    },
    "ask_id_type": {
        "en": "This field asks for your identity document. You can use {options}. {wallet}Which one do you have available?",
        "hi": "यह फ़ील्ड आपके पहचान दस्तावेज़ के बारे में है। आप {options} दे सकते हैं। {wallet}आपके पास कौन-सा उपलब्ध है?",
        "kn": "ಈ ಕ್ಷೇತ್ರ ನಿಮ್ಮ ಗುರುತಿನ ದಾಖಲೆಯನ್ನು ಕೇಳುತ್ತದೆ. ನೀವು {options} ಬಳಸಬಹುದು. {wallet}ನಿಮ್ಮ ಬಳಿ ಯಾವುದು ಲಭ್ಯವಿದೆ?",
    },
    "ask_after_choice": {
        "en": "Okay. The next field asks for your **{label}**. {hint}",
        "hi": "ठीक है। अगला फ़ील्ड आपकी **{label}** पूछता है। {hint}",
        "kn": "ಸರಿ. ಮುಂದಿನ ಕ್ಷೇತ್ರ ನಿಮ್ಮ **{label}** ಕೇಳುತ್ತದೆ. {hint}",
    },
    "wallet_has": {"en": "I can see {doc} in your document wallet. ", "hi": "आपके दस्तावेज़ वॉलेट में {doc} है। ", "kn": "ನಿಮ್ಮ ದಾಖಲೆ ವಾಲೆಟ್‌ನಲ್ಲಿ {doc} ಇದೆ. "},
    "ask_declaration": {
        "en": "Last step: please read the **declaration** on the form and tick the box yourself if everything is true. I won't tick it for you.",
        "hi": "अंतिम चरण: कृपया फ़ॉर्म पर **घोषणा** पढ़ें और यदि सब सही है तो बॉक्स स्वयं टिक करें। मैं इसे आपकी ओर से टिक नहीं करूँगा।",
        "kn": "ಕೊನೆಯ ಹಂತ: ದಯವಿಟ್ಟು ಫಾರ್ಮ್‌ನಲ್ಲಿರುವ **ಘೋಷಣೆ** ಓದಿ, ಎಲ್ಲವೂ ಸರಿಯಾಗಿದ್ದರೆ ಬಾಕ್ಸ್ ಅನ್ನು ನೀವೇ ಟಿಕ್ ಮಾಡಿ. ನಾನು ನಿಮ್ಮ ಪರವಾಗಿ ಟಿಕ್ ಮಾಡುವುದಿಲ್ಲ.",
    },
    "suggest_profile": {
        "en": "Your profile says **{value}**. Say **yes** to use it, or tell me the correct value.",
        "hi": "आपकी प्रोफ़ाइल में **{value}** है। इसे उपयोग करने के लिए **हाँ** कहें, या सही जानकारी बताएँ।",
        "kn": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ನಲ್ಲಿ **{value}** ಇದೆ. ಅದನ್ನು ಬಳಸಲು **ಹೌದು** ಎನ್ನಿ, ಅಥವಾ ಸರಿಯಾದ ಮಾಹಿತಿ ತಿಳಿಸಿ.",
    },
    "filled": {"en": "Done — I've entered **{value}** for {label}.", "hi": "हो गया — मैंने {label} में **{value}** भर दिया है।", "kn": "ಆಯಿತು — {label} ನಲ್ಲಿ **{value}** ನಮೂದಿಸಿದ್ದೇನೆ."},
    "invalid": {"en": "That doesn't look like a valid {label}. {format}", "hi": "यह सही {label} नहीं लगता। {format}", "kn": "ಇದು ಸರಿಯಾದ {label} ಎಂದು ಕಾಣುತ್ತಿಲ್ಲ. {format}"},
    "skipped": {
        "en": "No problem. I've marked **{label}** as pending so you can come back to it. You can add a reminder to your notes.",
        "hi": "कोई बात नहीं। मैंने **{label}** को बाकी के रूप में चिह्नित किया है। आप इसे अपने नोट्स में याद दिलाने के लिए जोड़ सकते हैं।",
        "kn": "ಪರವಾಗಿಲ್ಲ. **{label}** ಅನ್ನು ಬಾಕಿ ಎಂದು ಗುರುತಿಸಿದ್ದೇನೆ. ನೆನಪಿಗಾಗಿ ಇದನ್ನು ನಿಮ್ಮ ಟಿಪ್ಪಣಿಗಳಿಗೆ ಸೇರಿಸಬಹುದು.",
    },
    "note_find": {"en": "Find {label}", "hi": "{label} ढूँढें", "kn": "{label} ಹುಡುಕಿ"},
    "section_done": {"en": "✓ **{section}** complete.", "hi": "✓ **{section}** पूरा।", "kn": "✓ **{section}** ಪೂರ್ಣ."},
    "all_done": {
        "en": "All required fields are complete. Please open **Review** to check everything. Nothing is submitted until you confirm.",
        "hi": "सभी ज़रूरी फ़ील्ड पूरे हो गए हैं। सब कुछ जाँचने के लिए **समीक्षा** खोलें। आपकी पुष्टि के बिना कुछ भी जमा नहीं होगा।",
        "kn": "ಎಲ್ಲಾ ಕಡ್ಡಾಯ ಕ್ಷೇತ್ರಗಳು ಪೂರ್ಣಗೊಂಡಿವೆ. ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸಲು **ಪರಿಶೀಲನೆ** ತೆರೆಯಿರಿ. ನಿಮ್ಮ ದೃಢೀಕರಣವಿಲ್ಲದೆ ಏನನ್ನೂ ಸಲ್ಲಿಸಲಾಗುವುದಿಲ್ಲ.",
    },
    "pending_left": {
        "en": "These fields are still pending: {fields}. Shall we fill **{label}** now?",
        "hi": "ये फ़ील्ड अभी बाकी हैं: {fields}। क्या अब **{label}** भरें?",
        "kn": "ಈ ಕ್ಷೇತ್ರಗಳು ಇನ್ನೂ ಬಾಕಿ ಇವೆ: {fields}. ಈಗ **{label}** ತುಂಬೋಣವೇ?",
    },
    "reask": {"en": "When you're ready, tell me your **{label}**.", "hi": "जब आप तैयार हों, अपनी **{label}** बताइए।", "kn": "ನೀವು ಸಿದ್ಧರಾದಾಗ, ನಿಮ್ಮ **{label}** ತಿಳಿಸಿ."},
    "switched": {"en": "Sure, let's change **{label}**.", "hi": "ठीक है, **{label}** बदलते हैं।", "kn": "ಸರಿ, **{label}** ಬದಲಾಯಿಸೋಣ."},
    "ask_again": {"en": "Please tell me the **{label}**.", "hi": "कृपया **{label}** बताइए।", "kn": "ದಯವಿಟ್ಟು **{label}** ತಿಳಿಸಿ."},
    "declaration_self": {
        "en": "For your protection, please tick the declaration box yourself after reading it.",
        "hi": "आपकी सुरक्षा के लिए, कृपया घोषणा पढ़कर बॉक्स स्वयं टिक करें।",
        "kn": "ನಿಮ್ಮ ರಕ್ಷಣೆಗಾಗಿ, ಘೋಷಣೆಯನ್ನು ಓದಿ ಬಾಕ್ಸ್ ಅನ್ನು ನೀವೇ ಟಿಕ್ ಮಾಡಿ.",
    },
    "field_explain": {"en": "This field asks for your **{label}**.", "hi": "यह फ़ील्ड आपकी **{label}** पूछता है।", "kn": "ಈ ಕ್ಷೇತ್ರ ನಿಮ್ಮ **{label}** ಕೇಳುತ್ತದೆ."},
    "note_ask_office": {"en": "Ask local office: {q}", "hi": "स्थानीय कार्यालय से पूछें: {q}", "kn": "ಸ್ಥಳೀಯ ಕಚೇರಿಯಲ್ಲಿ ಕೇಳಿ: {q}"},
    "english_hint": {"en": "", "hi": " (आधिकारिक पाठ अंग्रेज़ी में)", "kn": " (ಅಧಿಕೃತ ಪಠ್ಯ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ)"},
    "ended": {
        "en": "Assistance ended. Your progress and notes are saved — you can resume any time.",
        "hi": "सहायता समाप्त। आपकी प्रगति और नोट्स सुरक्षित हैं — आप कभी भी फिर से शुरू कर सकते हैं।",
        "kn": "ಸಹಾಯ ಮುಗಿದಿದೆ. ನಿಮ್ಮ ಪ್ರಗತಿ ಮತ್ತು ಟಿಪ್ಪಣಿಗಳು ಉಳಿಸಲಾಗಿದೆ — ಯಾವಾಗ ಬೇಕಾದರೂ ಮುಂದುವರಿಸಬಹುದು.",
    },
}

FORMAT = {
    "aadhaar": {"en": "Aadhaar has 12 digits and never starts with 0 or 1.", "hi": "आधार में 12 अंक होते हैं और यह 0 या 1 से शुरू नहीं होता।", "kn": "ಆಧಾರ್‌ನಲ್ಲಿ 12 ಅಂಕೆಗಳಿರುತ್ತವೆ ಮತ್ತು ಅದು 0 ಅಥವಾ 1 ರಿಂದ ಪ್ರಾರಂಭವಾಗುವುದಿಲ್ಲ."},
    "vid": {"en": "That looks like a 16-digit Virtual ID. Please give the 12-digit Aadhaar number instead.", "hi": "यह 16 अंकों की वर्चुअल आईडी लगती है। कृपया 12 अंकों का आधार नंबर दें।", "kn": "ಇದು 16 ಅಂಕೆಯ ವರ್ಚುವಲ್ ಐಡಿ ಇರಬಹುದು. ದಯವಿಟ್ಟು 12 ಅಂಕೆಯ ಆಧಾರ್ ಸಂಖ್ಯೆ ನೀಡಿ."},
    "dl": {"en": "A Karnataka licence number looks like KA05 20190012345.", "hi": "कर्नाटक लाइसेंस नंबर KA05 20190012345 जैसा होता है।", "kn": "ಕರ್ನಾಟಕ ಪರವಾನಗಿ ಸಂಖ್ಯೆ KA05 20190012345 ರೀತಿ ಇರುತ್ತದೆ."},
    "mobile": {"en": "Mobile numbers have 10 digits.", "hi": "मोबाइल नंबर में 10 अंक होते हैं।", "kn": "ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯಲ್ಲಿ 10 ಅಂಕೆಗಳಿರುತ್ತವೆ."},
    "ifsc": {"en": "IFSC has 11 characters, like SBIN0001234.", "hi": "IFSC में 11 अक्षर होते हैं, जैसे SBIN0001234।", "kn": "IFSC ನಲ್ಲಿ 11 ಅಕ್ಷರಗಳಿರುತ್ತವೆ, ಉದಾ: SBIN0001234."},
    "date": {"en": "Please say the date like 15/08/1985.", "hi": "कृपया तारीख 15/08/1985 की तरह बताएँ।", "kn": "ದಯವಿಟ್ಟು ದಿನಾಂಕವನ್ನು 15/08/1985 ರಂತೆ ತಿಳಿಸಿ."},
    "date_future": {"en": "The date cannot be in the future.", "hi": "तारीख भविष्य की नहीं हो सकती।", "kn": "ದಿನಾಂಕ ಭವಿಷ್ಯದ್ದಾಗಿರಬಾರದು."},
    "number": {"en": "Please give a number, for example 2.5 acres.", "hi": "कृपया संख्या बताएँ, जैसे 2.5 एकड़।", "kn": "ದಯವಿಟ್ಟು ಸಂಖ್ಯೆ ನೀಡಿ, ಉದಾ: 2.5 ಎಕರೆ."},
    "percent": {"en": "Please give a number between 0 and 100.", "hi": "कृपया 0 से 100 के बीच संख्या बताएँ।", "kn": "ದಯವಿಟ್ಟು 0 ರಿಂದ 100 ರೊಳಗಿನ ಸಂಖ್ಯೆ ನೀಡಿ."},
    "account": {"en": "Account numbers have 9 to 18 digits.", "hi": "खाता संख्या में 9 से 18 अंक होते हैं।", "kn": "ಖಾತೆ ಸಂಖ್ಯೆಯಲ್ಲಿ 9 ರಿಂದ 18 ಅಂಕೆಗಳಿರುತ್ತವೆ."},
    "select": {"en": "Please choose one of: {options}.", "hi": "कृपया इनमें से एक चुनें: {options}।", "kn": "ದಯವಿಟ್ಟು ಇವುಗಳಲ್ಲಿ ಒಂದನ್ನು ಆಯ್ಕೆಮಾಡಿ: {options}."},
    "survey": {"en": "Please give the survey number, for example 45/2A.", "hi": "कृपया सर्वे नंबर बताएँ, जैसे 45/2A।", "kn": "ದಯವಿಟ್ಟು ಸರ್ವೆ ನಂಬರ್ ತಿಳಿಸಿ, ಉದಾ: 45/2A."},
    "text": {"en": "Could you say that again?", "hi": "क्या आप दोबारा बता सकते हैं?", "kn": "ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳುವಿರಾ?"},
    "id_type_first": {"en": "Please choose the identity document type first.", "hi": "कृपया पहले पहचान दस्तावेज़ का प्रकार चुनें।", "kn": "ದಯವಿಟ್ಟು ಮೊದಲು ಗುರುತಿನ ದಾಖಲೆಯ ಪ್ರಕಾರ ಆಯ್ಕೆಮಾಡಿ."},
}


def f(key: str, lang: str, **kw) -> str:
    entry = F.get(key, {})
    s = entry.get(lang) or entry.get("en", key)
    return s.format(**kw) if kw else s


def fmt(key: str, lang: str, **kw) -> str:
    entry = FORMAT.get(key) or FORMAT["text"]
    s = entry.get(lang) or entry["en"]
    return s.format(**kw) if kw else s
