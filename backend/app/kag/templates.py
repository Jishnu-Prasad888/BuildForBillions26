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
        "en": "I told you this because of the following sources. You can read the exact evidence text in the sources:",
        "hi": "मैंने यह इन स्रोतों के आधार पर बताया। सटीक पाठ स्रोतों में पढ़ा जा सकता है:",
        "kn": "ಈ ಮೂಲಗಳ ಆಧಾರದ ಮೇಲೆ ನಾನು ಇದನ್ನು ಹೇಳಿದೆ. ನಿಖರವಾದ ಪಠ್ಯವನ್ನು ಮೂಲಗಳಲ್ಲಿ ಓದಬಹುದು:",
    },
    "why_none": {
        "en": "My previous answer did not rely on any official source.",
        "hi": "मेरा पिछला उत्तर किसी आधिकारिक स्रोत पर आधारित नहीं था।",
        "kn": "ನನ್ನ ಹಿಂದಿನ ಉತ್ತರ ಯಾವುದೇ ಅಧಿಕೃತ ಮೂಲವನ್ನು ಆಧರಿಸಿರಲಿಲ್ಲ.",
    },
    "greeting": {
        "en": "Namaste! I'm Sahayak. Tell me what happened in your own words, for example *\"Heavy rain destroyed my crop\"*, "
              "or ask about a scheme such as PM-KISAN or crop insurance. I'll find schemes that may help and show the official sources.",
        "hi": "नमस्ते! मैं सहायक हूँ। अपने शब्दों में बताइए क्या हुआ, जैसे *\"भारी बारिश से मेरी फसल नष्ट हो गई\"*, "
              "या PM-KISAN, फसल बीमा जैसी किसी योजना के बारे में पूछिए। मैं मदद करने वाली योजनाएँ और उनके आधिकारिक स्रोत दिखाऊँगा।",
        "kn": "ನಮಸ್ಕಾರ! ನಾನು ಸಹಾಯಕ. ಏನಾಯಿತು ಎಂದು ನಿಮ್ಮ ಮಾತುಗಳಲ್ಲಿ ಹೇಳಿ, ಉದಾ. *\"ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ನಾಶವಾಯಿತು\"*, "
              "ಅಥವಾ PM-KISAN, ಬೆಳೆ ವಿಮೆಯಂತಹ ಯೋಜನೆಯ ಬಗ್ಗೆ ಕೇಳಿ. ಸಹಾಯ ಮಾಡಬಹುದಾದ ಯೋಜನೆಗಳು ಮತ್ತು ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ತೋರಿಸುತ್ತೇನೆ.",
    },
    "thanks": {
        "en": "You're welcome! Ask me anything else about schemes, documents or how to apply.",
        "hi": "आपका स्वागत है! योजनाओं, दस्तावेज़ों या आवेदन के बारे में और कुछ भी पूछिए।",
        "kn": "ಸ್ವಾಗತ! ಯೋಜನೆಗಳು, ದಾಖಲೆಗಳು ಅಥವಾ ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಬಗ್ಗೆ ಇನ್ನೇನಾದರೂ ಕೇಳಿ.",
    },
    "about": {
        "en": "I'm Sahayak, an assistant for government schemes. I can:\n"
              "- find schemes that fit your situation\n- explain who is eligible and how much you may get\n"
              "- list the documents you need and how to apply\n\n"
              "Every answer comes from official sources, which I show you. Try: *\"Heavy rain destroyed my crop.\"*",
        "hi": "मैं सहायक हूँ, सरकारी योजनाओं का सहायक। मैं:\n"
              "- आपकी स्थिति के अनुसार योजनाएँ खोज सकता हूँ\n- पात्रता और मिलने वाली राशि बता सकता हूँ\n"
              "- ज़रूरी दस्तावेज़ और आवेदन का तरीका बता सकता हूँ\n\n"
              "हर उत्तर आधिकारिक स्रोतों पर आधारित होता है। आज़माइए: *\"भारी बारिश से मेरी फसल नष्ट हो गई।\"*",
        "kn": "ನಾನು ಸಹಾಯಕ, ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಸಹಾಯಕ. ನಾನು:\n"
              "- ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಗೆ ಹೊಂದುವ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕುತ್ತೇನೆ\n- ಅರ್ಹತೆ ಮತ್ತು ಸಿಗುವ ಮೊತ್ತವನ್ನು ವಿವರಿಸುತ್ತೇನೆ\n"
              "- ಬೇಕಾದ ದಾಖಲೆಗಳು ಮತ್ತು ಅರ್ಜಿ ವಿಧಾನ ತಿಳಿಸುತ್ತೇನೆ\n\n"
              "ಪ್ರತಿ ಉತ್ತರ ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ಆಧರಿಸಿದೆ. ಪ್ರಯತ್ನಿಸಿ: *\"ಭಾರಿ ಮಳೆಯಿಂದ ನನ್ನ ಬೆಳೆ ನಾಶವಾಯಿತು.\"*",
    },
    "out_of_scope_hint": {
        "en": "I can answer questions about government schemes: which schemes fit your situation, eligibility, benefits, documents and how to apply.",
        "hi": "मैं सरकारी योजनाओं से जुड़े सवालों के जवाब दे सकता हूँ: कौन-सी योजना आपके लिए है, पात्रता, लाभ, दस्तावेज़ और आवेदन का तरीका।",
        "kn": "ನಾನು ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಕುರಿತ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಬಲ್ಲೆ: ಯಾವ ಯೋಜನೆ ನಿಮಗೆ ಸೂಕ್ತ, ಅರ್ಹತೆ, ಪ್ರಯೋಜನ, ದಾಖಲೆಗಳು ಮತ್ತು ಅರ್ಜಿ ವಿಧಾನ.",
    },
    "next_apply_chat": {
        "en": "Tap a scheme below to see its documents, eligibility and how to apply.",
        "hi": "दस्तावेज़, पात्रता और आवेदन का तरीका देखने के लिए नीचे किसी योजना पर टैप करें।",
        "kn": "ದಾಖಲೆಗಳು, ಅರ್ಹತೆ ಮತ್ತು ಅರ್ಜಿ ವಿಧಾನ ನೋಡಲು ಕೆಳಗಿನ ಯೋಜನೆಯನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ.",
    },
    "amount_intro": {
        "en": "Benefit under **{scheme}**:",
        "hi": "**{scheme}** के तहत लाभ:",
        "kn": "**{scheme}** ಅಡಿಯಲ್ಲಿ ಪ್ರಯೋಜನ:",
    },
    "apply_intro": {
        "en": "How to apply for **{scheme}**:",
        "hi": "**{scheme}** के लिए आवेदन कैसे करें:",
        "kn": "**{scheme}** ಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸುವುದು ಹೇಗೆ:",
    },
    "apply_portal": {
        "en": "Apply through: {portal}",
        "hi": "आवेदन यहाँ करें: {portal}",
        "kn": "ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಸ್ಥಳ: {portal}",
    },
    "other_schemes": {
        "en": "I answered for {scheme}. You can also ask about: {others}.",
        "hi": "मैंने {scheme} के लिए बताया। आप इनके बारे में भी पूछ सकते हैं: {others}।",
        "kn": "ನಾನು {scheme} ಬಗ್ಗೆ ಹೇಳಿದೆ. ಇವುಗಳ ಬಗ್ಗೆಯೂ ಕೇಳಬಹುದು: {others}.",
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
