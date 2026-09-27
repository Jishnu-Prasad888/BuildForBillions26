#!/usr/bin/env python3
"""Builds assets/corpus.json, the offline knowledge base bundled into the app, from the repo's data/ folder.

Reads ONLY data/documents, data/seed/graph.json and data/seed/forms. data/users holds citizens' uploaded forms and
must never be bundled into an app, so it is never opened here.

The on-device pipeline is English-only (whisper EN + MiniLM), so Hindi/Kannada labels in the seed data are left out.

Usage (from anywhere):  python3 whisper-chat-app/scripts/build_corpus.py
PDF text comes from `pdftotext` (poppler) or, failing that, PyMuPDF. If neither works the script stops with an error.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
DATA = APP.parent / "data"
OUT = APP / "assets" / "corpus.json"


def clean(text: str) -> str:
    text = text.replace("\r", "").replace("\x0c", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def parse_front_matter(text: str) -> tuple[dict, str]:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, text[m.end():]


def pdf_text(path: Path) -> str:
    if shutil.which("pdftotext"):
        out = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, check=True)
        return out.stdout
    try:
        import fitz  # PyMuPDF
    except ImportError:
        sys.exit(f"ERROR: cannot read {path.name}: install poppler-utils (pdftotext) or PyMuPDF")
    with fitz.open(path) as doc:
        return "\n".join(page.get_text() for page in doc)


def from_documents() -> list[dict]:
    docs = []
    for path in sorted((DATA / "documents").iterdir()):
        if path.suffix == ".md":
            meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
            title, text = meta.get("title") or path.stem, body
        elif path.suffix == ".pdf":
            text = pdf_text(path)
            title = clean(text).split("\n", 1)[0]
        else:
            print(f"WARN: skipped data/documents/{path.name} (unsupported type)")
            continue
        text = clean(text)
        if len(text) < 50:
            sys.exit(f"ERROR: data/documents/{path.name} produced almost no text ({len(text)} chars)")
        docs.append({"id": f"doc-{path.stem}", "title": title, "source": f"data/documents/{path.name}", "text": text})
    return docs


def from_graph() -> list[dict]:
    g = json.loads((DATA / "seed" / "graph.json").read_text(encoding="utf-8"))
    note = g.get("_note", "")
    name = lambda coll, code: next((x["name"] for x in g[coll] if x["code"] == code), code)
    portals = {p["code"]: p for p in g["portals"]}
    docs = []
    for s in g["schemes"]:
        lines = [f"Scheme: {s['name']} ({s['short_name']})" if s.get("short_name") else f"Scheme: {s['name']}",
                 f"Summary: {s['summary']}", f"Benefit: {s['benefit']}",
                 f"Run by: {name('departments', s['department'])}",
                 "Applies in: " + ", ".join(name("states", c) for c in s["states"]),
                 "Documents needed: " + "; ".join(name("document_requirements", c) for c in s["documents"])]
        portal = portals.get(s["portal"])
        if portal:
            lines.append(f"Official portal: {portal['name']} ({portal['url']})")
        if s.get("rules"):
            lines.append("Eligibility rules:")
            lines += [f"- {r['text']}" for r in s["rules"]]
        lines.append(f"Note: {note}")
        docs.append({"id": f"scheme-{s['code'].lower()}", "title": f"{s['name']} (DEMO seed summary)",
                     "source": "data/seed/graph.json", "text": "\n".join(lines)})
    for e in g["life_events"]:
        docs.append({"id": f"event-{e['code'].lower()}", "title": f"Situation: {e['name']}", "source": "data/seed/graph.json",
                     "text": f"Situation: {e['name']} (for {e['context']}s)\n{e['description']}\nCommon words: "
                             + ", ".join(e["keywords"]["en"])})
    return docs


def from_forms() -> list[dict]:
    docs = []
    for path in sorted((DATA / "seed" / "forms").glob("*.json")):
        f = json.loads(path.read_text(encoding="utf-8"))
        lines = [f"Application form: {f['title']}", f"Issued by: {f['authority']}"]
        for sec in f["sections"]:
            fields = []
            for fld in sec["fields"]:
                label = fld["label"] + (" (required)" if fld.get("required") else "")
                if fld.get("options"):
                    label += " - choose one of: " + ", ".join(fld["options"])
                fields.append(label)
            lines.append(f"Section '{sec['title']}' asks for: " + "; ".join(fields))
        docs.append({"id": f"form-{f['id']}", "title": f"{f['title']} (DEMO form)", "source": f"data/seed/forms/{path.name}",
                     "text": "\n".join(lines)})
    return docs


def main() -> None:
    documents = from_documents() + from_graph() + from_forms()
    ids = [d["id"] for d in documents]
    assert len(ids) == len(set(ids)), "duplicate document ids"
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"documents": documents}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    chars = sum(len(d["text"]) for d in documents)
    print(f"wrote {OUT.relative_to(APP.parent)}: {len(documents)} documents, {chars} chars")
    for d in documents:
        print(f"  {d['id']:<40} {len(d['text']):>5} chars  <- {d['source']}")


if __name__ == "__main__":
    main()
