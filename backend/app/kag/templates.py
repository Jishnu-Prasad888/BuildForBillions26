"""Localized phrases for deterministic (non-LLM) answer composition and the form assistant."""

T = {
    "insufficient": {
        "en": "I couldn't find enough information in the available official sources to verify that.",
        "hi": "मुझे उपलब्ध आधिकारिक स्रोतों में इसकी पुष्टि करने के लिए पर्याप्त जानकारी नहीं मिली।",
        "kn": "ಲಭ್ಯವಿರುವ ಅಧಿಕೃತ ಮೂಲಗಳಲ್ಲಿ ಇದನ್ನು ಖಚಿತಪಡಿಸಲು ಸಾಕಷ್ಟು ಮಾಹಿತಿ ನನಗೆ ಸಿಗಲಿಲ್ಲ.",
    },
    "insufficient_hint": {
        "en": "You could ask at your local Raitha Samparka Kendra, taluk office or bank branch.",
        "hi": "आप अपने स्थानीय कृषि केंद्र, तालुक कार्यालय या बैंक शाखा में पूछ सकते हैं।",
        "kn": "ನಿಮ್ಮ ಸ್ಥಳೀಯ ರೈತ ಸಂಪರ್ಕ ಕೇಂದ್ರ, ತಾಲ್ಲೂಕು ಕಚೇರಿ ಅಥವಾ ಬ್ಯಾಂಕ್ ಶಾಖೆಯಲ್ಲಿ ಕೇಳಬಹುದು.",
    },
    "life_event_intro": {
        "en": "I'm sorry to hear that. It sounds like you are dealing with **{event}**. Based on the official sources available to me, these schemes may help:",
        "hi": "यह सुनकर दुख हुआ। लगता है आप **{event}** की स्थिति में हैं। उपलब्ध आधिकारिक स्रोतों के आधार पर ये योजनाएँ आपकी मदद कर सकती हैं:",
        "kn": "ಇದನ್ನು ಕೇಳಿ ಬೇಸರವಾಯಿತು. ನೀವು **{event}** ಪರಿಸ್ಥಿತಿಯಲ್ಲಿದ್ದೀರಿ ಎಂದು ತೋರುತ್ತದೆ. ಲಭ್ಯವಿರುವ ಅಧಿಕೃತ ಮೂಲಗಳ ಆಧಾರದ ಮೇಲೆ ಈ ಯೋಜನೆಗಳು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಹುದು:",
    },
    "why_applies": {"en": "Why it may apply", "hi": "यह क्यों लागू हो सकती है", "kn": "ಇದು ಏಕೆ ಅನ್ವಯಿಸಬಹುದು"},
    "documents": {"en": "Documents", "hi": "दस्तावेज़", "kn": "ದಾಖಲೆಗಳು"},
    "benefit": {"en": "Benefit", "hi": "लाभ", "kn": "ಪ್ರಯೋಜನ"},
    "next_apply": {
        "en": "Would you like to start an application? Choose **Apply** on a scheme card below.",
        "hi": "क्या आप आवेदन शुरू करना चाहेंगे? नीचे योजना कार्ड पर **आवेदन करें** चुनें।",
        "kn": "ಅರ್ಜಿ ಪ್ರಾರಂಭಿಸಲು ಬಯಸುವಿರಾ? ಕೆಳಗಿನ ಯೋಜನೆ ಕಾರ್ಡ್‌ನಲ್ಲಿ **ಅರ್ಜಿ ಸಲ್ಲಿಸಿ** ಆಯ್ಕೆಮಾಡಿ.",
    },
    "general_intro": {"en": "Here is what the official sources say:", "hi": "आधिकारिक स्रोत यह कहते हैं:", "kn": "ಅಧಿಕೃತ ಮೂಲಗಳು ಹೀಗೆ ಹೇಳುತ್ತವೆ:"},
    "docs_intro": {
        "en": "For **{scheme}**, the official sources list these documents:",
        "hi": "**{scheme}** के लिए आधिकारिक स्रोत ये दस्तावेज़ बताते हैं:",
        "kn": "**{scheme}** ಗಾಗಿ ಅಧಿಕೃತ ಮೂಲಗಳು ಈ ದಾಖಲೆಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡುತ್ತವೆ:",
    },
    "elig_intro": {
        "en": "Eligibility for **{scheme}** according to the official sources:",
        "hi": "आधिकारिक स्रोतों के अनुसार **{scheme}** की पात्रता:",
        "kn": "ಅಧಿಕೃತ ಮೂಲಗಳ ಪ್ರಕಾರ **{scheme}** ಅರ್ಹತೆ:",
    },
    "english_note": {"en": "", "hi": "(आधिकारिक पाठ अंग्रेज़ी में है)", "kn": "(ಅಧಿಕೃತ ಪಠ್ಯ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿದೆ)"},
    "verify_note": {
        "en": "Please confirm final details on the official portal before you apply.",
        "hi": "आवेदन से पहले अंतिम जानकारी आधिकारिक पोर्टल पर अवश्य जाँच लें।",
        "kn": "ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಮೊದಲು ಅಂತಿಮ ವಿವರಗಳನ್ನು ಅಧಿಕೃತ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ದೃಢೀಕರಿಸಿ.",
    },
    "why_answer": {
        "en": "I told you this because of the following sources. Open **Sources used** to read the exact evidence text:",
        "hi": "मैंने यह इन स्रोतों के आधार पर बताया। सटीक पाठ पढ़ने के लिए **उपयोग किए गए स्रोत** खोलें:",
        "kn": "ಈ ಮೂಲಗಳ ಆಧಾರದ ಮೇಲೆ ನಾನು ಇದನ್ನು ಹೇಳಿದೆ. ನಿಖರವಾದ ಪಠ್ಯವನ್ನು ಓದಲು **ಬಳಸಿದ ಮೂಲಗಳು** ತೆರೆಯಿರಿ:",
    },
    "why_none": {
        "en": "My previous answer did not rely on any official source.",
        "hi": "मेरा पिछला उत्तर किसी आधिकारिक स्रोत पर आधारित नहीं था।",
        "kn": "ನನ್ನ ಹಿಂದಿನ ಉತ್ತರ ಯಾವುದೇ ಅಧಿಕೃತ ಮೂಲವನ್ನು ಆಧರಿಸಿರಲಿಲ್ಲ.",
    },
    "unverified": {
        "en": "_Note: I could not link this answer to a specific official source. Please verify it._",
        "hi": "_ध्यान दें: मैं इस उत्तर को किसी आधिकारिक स्रोत से नहीं जोड़ पाया। कृपया इसकी पुष्टि करें।_",
        "kn": "_ಗಮನಿಸಿ: ಈ ಉತ್ತರವನ್ನು ಯಾವುದೇ ಅಧಿಕೃತ ಮೂಲಕ್ಕೆ ಲಿಂಕ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ._",
    },
}


def t(key: str, lang: str, **kw) -> str:
    entry = T.get(key, {})
    s = entry.get(lang) or entry.get("en", key)
    return s.format(**kw) if kw else s


def localized_name(obj: dict, lang: str) -> str:
    if lang != "en":
        n = (obj.get("names") or {}).get(lang)
        if n:
            return n
    return obj.get("name", "")
