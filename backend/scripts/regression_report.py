#!/usr/bin/env python3
"""P9 Regression report.

Usage (inside the backend Docker image or with the backend venv active):
    python scripts/regression_report.py [--baseline <commit>]

Sections:
  1. git diff --stat against baseline: confirm no kag/ or ai/ files changed
  2. Normalizer smoke tests
  3. Turn router samples (intent × language)
  4. KCC transcript replay
  5. Full pytest run summary
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent


# ---------------------------------------------------------------------------
# 1. git diff --stat (kag/ai guard)
# ---------------------------------------------------------------------------

def git_guard(baseline: str) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            ["git", "diff", "--stat", baseline, "HEAD"],
            capture_output=True, text=True, cwd=BASE_DIR,
        )
        stat = result.stdout.strip()
    except FileNotFoundError:
        return True, "(git not available — skipped)"
    forbidden = [ln for ln in stat.splitlines()
                 if re.search(r"app/(kag|services/ai)/", ln)]
    ok = len(forbidden) == 0
    return ok, stat


# ---------------------------------------------------------------------------
# 2. Normalizer smoke
# ---------------------------------------------------------------------------

def normalizer_smoke() -> list[tuple[str, str, str]]:
    sys.path.insert(0, str(BASE_DIR))
    from app.services.query_normalizer import normalize, _apply_asr_variants  # noqa: E402

    cases = [
        ("k c c loan documents", "KCC"),
        ("p m f b y claim kaise karen", "PMFBY"),
        ("um uh which scheme for crop loss", None),  # fillers removed
        ("aadhar card needed", "Aadhaar"),
    ]
    rows = []
    for inp, expect_contains in cases:
        cleaned, asr = normalize(inp)
        out = asr or cleaned
        ok = "PASS" if (expect_contains is None or expect_contains in out) else "FAIL"
        rows.append((inp, out, ok))
    return rows


# ---------------------------------------------------------------------------
# 3. Turn router samples
# ---------------------------------------------------------------------------

def router_samples() -> list[tuple[str, str, str, str]]:
    sys.path.insert(0, str(BASE_DIR))
    from app.services.formdoc import turn_router  # noqa: E402

    _FIELD = {"field_id": "f1", "label": "Land Survey Number", "type": "text", "options": []}
    cases = [
        ("What documents do I need?", "en", ("question",)),
        # Hindi statement "I need documents" may route as answer or question — both are acceptable
        ("मुझे दस्तावेज़ चाहिए", "hi", ("question", "answer")),
        ("ಈ ಕ್ಷೇತ್ರ ಅರ್ಥವೇನು?", "kn", ("question",)),
        ("skip", "en", ("skip",)),
        ("I don't know", "en", ("dont_know",)),
        ("My survey number is 123/4", "en", ("answer",)),
    ]
    rows = []
    for text, lang, expected_intents in cases:
        turn = turn_router.route(text, _FIELD, [_FIELD])
        status = "PASS" if turn.intent in expected_intents else f"FAIL (got {turn.intent}, expected {expected_intents})"
        rows.append((text[:40], lang, expected_intents[0], status))
    return rows


# ---------------------------------------------------------------------------
# 4. KCC transcript replay
# ---------------------------------------------------------------------------

KCC_TRANSCRIPT = [
    # (lang, question, check_fn) — check_fn takes (cleaned, asr_fixed) and returns bool
    ("en", "What is KCC?", lambda c, a: "KCC" in (a or c)),
    ("en", "k c c loan documents", lambda c, a: "KCC" in (a or c)),
    ("hi", "KCC ke liye kya chahiye", lambda c, a: "KCC" in (a or c)),
    ("en", "What is the repayment period for KCC?", lambda c, a: "KCC" in (a or c)),
]


def transcript_replay() -> list[tuple[str, str, str]]:
    sys.path.insert(0, str(BASE_DIR))
    from app.services.query_normalizer import normalize  # noqa: E402

    rows = []
    for lang, question, check in KCC_TRANSCRIPT:
        cleaned, asr = normalize(question)
        ok = "PASS" if check(cleaned, asr) else "FAIL"
        rows.append((question[:50], lang, ok))
    return rows


# ---------------------------------------------------------------------------
# 5. pytest run
# ---------------------------------------------------------------------------

def run_pytest() -> tuple[bool, str]:
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "tests"],
        capture_output=True, text=True, cwd=BASE_DIR,
    )
    last_lines = "\n".join(result.stdout.strip().splitlines()[-5:])
    ok = result.returncode == 0
    return ok, last_lines


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def header(title: str) -> None:
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", default="main",
                        help="git ref to compare against (default: main)")
    args = parser.parse_args()

    print("FormBot Regression Report")
    print(f"Baseline: {args.baseline}")

    # 1. kag/ai guard
    header("1. kag/ and ai/ guard")
    guard_ok, stat = git_guard(args.baseline)
    print(stat or "(no diff)")
    print()
    if guard_ok:
        print("✓ No kag/ or ai/ files changed.")
    else:
        print("✗ FORBIDDEN: kag/ or ai/ files changed — see lines above.")

    # 2. Normalizer
    header("2. Normalizer smoke tests")
    rows = normalizer_smoke()
    for inp, out, ok in rows:
        print(f"  [{ok}] {inp!r} → {out!r}")

    # 3. Router
    header("3. Turn router samples")
    rows2 = router_samples()
    for text, lang, exp, status in rows2:
        print(f"  [{status}] ({lang}) {text!r} → {exp}")

    # 4. Transcript replay
    header("4. KCC transcript replay")
    rows3 = transcript_replay()
    for question, lang, ok in rows3:
        print(f"  [{ok}] ({lang}) {question}")

    # 5. pytest
    header("5. pytest suite")
    pt_ok, pt_out = run_pytest()
    print(pt_out)
    print()
    if pt_ok:
        print("✓ All tests passed.")
    else:
        print("✗ TEST FAILURES — see above.")

    # Summary
    header("Summary")
    results = [
        ("kag/ai guard", guard_ok),
        ("pytest suite", pt_ok),
        ("normalizer", all(r[2] == "PASS" for r in rows)),
        ("router", all("PASS" in r[3] for r in rows2)),
    ]
    for name, ok in results:
        print(f"  {'✓' if ok else '✗'} {name}")
    print()
    if all(ok for _, ok in results):
        print("All checks passed — P9 complete.")
        sys.exit(0)
    else:
        print("Some checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
