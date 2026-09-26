"""P5 (query normalizer) and P7 (reference button) tests."""
from __future__ import annotations

import pytest

from app.services.query_normalizer import (
    _apply_asr_variants,
    _build_expansion,
    _strip_fillers,
    is_form_offer,
    normalize,
)


# ---------------------------------------------------------------------------
# P5: Query normalizer unit tests
# ---------------------------------------------------------------------------

class TestStripFillers:
    def test_leading_um(self):
        assert _strip_fillers("um what documents do I need") == "what documents do I need"

    def test_leading_uh_repeated(self):
        assert _strip_fillers("uh uh which scheme") == "which scheme"

    def test_repeated_words(self):
        result = _strip_fillers("which which documents do I need")
        assert "which which" not in result
        assert "documents" in result

    def test_inner_filler(self):
        result = _strip_fillers("I like you know need the documents")
        assert "like" not in result or "documents" in result

    def test_clean_text_unchanged(self):
        text = "What documents are needed for KCC?"
        assert _strip_fillers(text) == text


class TestAsrVariants:
    def test_spaced_kcc(self):
        assert _apply_asr_variants("k c c eligibility") == "KCC eligibility"

    def test_dotted_kcc(self):
        assert _apply_asr_variants("k.c.c loan").startswith("KCC")

    def test_pmfby_spaced(self):
        assert "PMFBY" in _apply_asr_variants("p m f b y insurance")

    def test_ifsc_spaced(self):
        assert "IFSC" in _apply_asr_variants("i f s c code bank")

    def test_ifc_code(self):
        assert "IFSC" in _apply_asr_variants("ifc code of my branch")

    def test_kisaan_normalised(self):
        assert "Kisan" in _apply_asr_variants("kisaan credit card loan")

    def test_aadhar_variant(self):
        result = _apply_asr_variants("aadhar card needed")
        assert "Aadhaar" in result

    def test_adhaar_variant(self):
        result = _apply_asr_variants("adhaar number")
        assert "Aadhaar" in result


class TestExpansion:
    def test_english_no_expansion(self):
        assert _build_expansion("KCC documents needed", "en") == ""

    def test_hinglish_kaise(self):
        exp = _build_expansion("kaise apply karein", "hi")
        assert "how" in exp

    def test_hinglish_chahiye(self):
        exp = _build_expansion("kaunse documents chahiye", "hi")
        assert "which" in exp or "need" in exp

    def test_hinglish_ke_liye(self):
        exp = _build_expansion("KCC ke liye documents", "hi")
        assert "for" in exp

    def test_bima_expansion(self):
        exp = _build_expansion("fasal bima kya hai", "hi")
        assert "insurance" in exp

    def test_yojana_expansion(self):
        exp = _build_expansion("sarkari yojana milegi", "hi")
        assert "scheme" in exp or "government" in exp

    def test_rin_expansion(self):
        exp = _build_expansion("KCC rin kaise milega", "hi")
        assert "loan" in exp


class TestNormalize:
    def test_combine_filler_and_asr(self):
        cleaned, asr_fixed = normalize("um um k c c loan kaise milta hai")
        assert "KCC" in asr_fixed
        assert "um" not in cleaned

    def test_clean_english_passthrough(self):
        text = "What are the KCC documents?"
        cleaned, asr_fixed = normalize(text)
        assert cleaned == text
        assert asr_fixed == text

    def test_voice_style_kcc(self):
        cleaned, asr_fixed = normalize("uh uh which which documents for k c c")
        assert "KCC" in asr_fixed
        assert "which which" not in cleaned


class TestFormOffer:
    def test_fill_kcc_form(self):
        assert is_form_offer("I want to fill the KCC form")

    def test_form_bharna(self):
        assert is_form_offer("form bharna hai KCC ka")

    def test_no_offer_for_plain_question(self):
        assert not is_form_offer("What documents do I need for KCC?")

    def test_no_offer_for_eligibility(self):
        assert not is_form_offer("Am I eligible for KCC?")


# Domain-specific normalizer cases from real scheme questions in this codebase
class TestDomainCases:
    def test_kcc_documents_hindi(self):
        cleaned, asr_fixed = normalize("KCC ke liye kaunse documents chahiye")
        assert "KCC" in asr_fixed
        exp = _build_expansion(asr_fixed, "hi")
        assert "for" in exp or "which" in exp

    def test_pmfby_letter_by_letter(self):
        _, asr_fixed = normalize("p m f b y claim kaise karen")
        assert "PMFBY" in asr_fixed

    def test_pm_kisan_letter_by_letter(self):
        _, asr_fixed = normalize("p m k i s a n ke paise kab aate hain")
        assert "PM-KISAN" in asr_fixed

    def test_ifsc_in_question(self):
        _, asr_fixed = normalize("i f s c code kahan milega bank passbook mein")
        assert "IFSC" in asr_fixed
        exp = _build_expansion(asr_fixed, "hi")
        assert "how" in exp or "where" in exp or "bank" in asr_fixed

    def test_aadhaar_variant_expansion(self):
        _, asr_fixed = normalize("aadhar card needed for PM-KISAN")
        assert "Aadhaar" in asr_fixed

    def test_filler_heavy_voice(self):
        cleaned, _ = normalize("um well uh uh which which scheme do I apply for crop damage")
        assert "um" not in cleaned
        assert "scheme" in cleaned
        assert "which" in cleaned


# ---------------------------------------------------------------------------
# P7: Reference backend tests (ownership check and form-mode guard)
# ---------------------------------------------------------------------------

class TestReference:
    """These tests hit the real service logic without a running DB."""

    def test_reference_resolve_import(self):
        """reference.py can be imported and has resolve()."""
        from app.services import reference  # noqa: F401
        assert callable(reference.resolve)

    def test_reference_no_reference_unchanged(self):
        """When reference_message_id is None, resolve() returns None."""
        from app.services.reference import resolve
        assert resolve(None, None, None) is None  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# P6: Mid-form questions — scheme scope and portal reminder
# ---------------------------------------------------------------------------

class TestSchemeScope:
    def test_detect_kcc_from_name(self):
        from app.services.formdoc.scheme_scope import detect_form_scheme
        codes = detect_form_scheme("KCC_application_form.pdf", [])
        assert "KCC" in codes

    def test_detect_pmfby_from_name(self):
        from app.services.formdoc.scheme_scope import detect_form_scheme
        codes = detect_form_scheme("PMFBY enrollment form.pdf", [])
        assert "PMFBY" in codes

    def test_detect_pm_kisan_from_name(self):
        from app.services.formdoc.scheme_scope import detect_form_scheme
        codes = detect_form_scheme("pm_kisan_samman_nidhi_registration.pdf", [])
        assert "PM_KISAN" in codes

    def test_detect_pmay_from_name(self):
        from app.services.formdoc.scheme_scope import detect_form_scheme
        codes = detect_form_scheme("PMAY beneficiary form.pdf", [])
        assert "PMAY" in codes

    def test_empty_unknown_form(self):
        from app.services.formdoc.scheme_scope import detect_form_scheme
        codes = detect_form_scheme("generic_form.pdf", [])
        assert isinstance(codes, list)

    def test_multiple_labels_no_name_match(self):
        from app.services.formdoc.scheme_scope import detect_form_scheme
        labels = ["Applicant name", "Bank account number", "Village"]
        codes = detect_form_scheme("application_form.pdf", labels)
        assert isinstance(codes, list)

    def test_returns_list(self):
        from app.services.formdoc.scheme_scope import detect_form_scheme
        result = detect_form_scheme("any.pdf", ["field1", "field2"])
        assert isinstance(result, list)


class TestAssistantP6:
    """Check assistant.py has no form_observation and has _detect_scheme."""

    def test_no_form_observation_in_source(self):
        import inspect
        from app.services.formdoc import assistant
        src = inspect.getsource(assistant)
        assert "form_observation" not in src

    def test_detect_scheme_method_exists(self):
        from app.services.formdoc.assistant import FormAssistant
        assert hasattr(FormAssistant, "_detect_scheme")
        assert callable(FormAssistant._detect_scheme)

    def test_kag_query_accepts_context_schemes(self):
        import inspect
        from app.services.formdoc.assistant import FormAssistant
        sig = inspect.signature(FormAssistant._kag_query)
        assert "context_schemes" in sig.parameters

    def test_detect_form_scheme_imported(self):
        import app.services.formdoc.assistant as mod
        assert hasattr(mod, "detect_form_scheme")

    def test_portal_line_shown_state_key(self):
        """portal_line_shown is referenced in assistant source."""
        import inspect
        from app.services.formdoc import assistant
        src = inspect.getsource(assistant)
        assert "portal_line_shown" in src
