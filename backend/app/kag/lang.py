"""Lightweight language detection by script (enough for en / hi / kn)."""
import re

SUPPORTED_LANGUAGES = {"en": "English", "hi": "हिन्दी (Hindi)", "kn": "ಕನ್ನಡ (Kannada)"}
LANGUAGE_NAMES_EN = {"en": "English", "hi": "Hindi", "kn": "Kannada"}


def detect_language(text: str, default: str = "en") -> str:
    deva = len(re.findall(r"[ऀ-ॿ]", text))
    kann = len(re.findall(r"[ಀ-೿]", text))
    latin = len(re.findall(r"[A-Za-z]", text))
    if kann > max(deva, latin * 0.3):
        return "kn"
    if deva > max(kann, latin * 0.3):
        return "hi"
    return "en" if latin else default
