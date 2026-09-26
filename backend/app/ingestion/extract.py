"""Text extraction for PDF / TXT / Markdown / HTML / DOCX.

Each extractor returns a list of *blocks*: {"text", "section", "page"} so that
provenance (section heading, page number) survives chunking.
"""
from __future__ import annotations

import io
import re

from bs4 import BeautifulSoup

ALLOWED_EXTENSIONS = {".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown",
                      ".markdown": "text/markdown", ".html": "text/html", ".htm": "text/html",
                      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


def parse_front_matter(text: str) -> tuple[dict, str]:
    """Minimal YAML-ish front matter parser (key: value, [a, b] lists)."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    meta: dict = {}
    for line in text[3:end].strip().splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        v = v.strip()
        if v.startswith("[") and v.endswith("]"):
            meta[k.strip()] = [x.strip() for x in v[1:-1].split(",") if x.strip()]
        elif v.lower() in ("true", "false"):
            meta[k.strip()] = v.lower() == "true"
        else:
            meta[k.strip()] = v or None
    return meta, text[end + 4 :].lstrip("\n")


def clean_text(text: str) -> str:
    text = text.replace(" ", " ").replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_markdown(text: str) -> list[dict]:
    blocks, section, buf = [], None, []

    def flush():
        if buf:
            t = clean_text("\n".join(buf))
            if t:
                blocks.append({"text": t, "section": section, "page": None})
            buf.clear()

    for line in text.splitlines():
        m = re.match(r"^(#{1,6})\s+(.*)", line)
        if m:
            flush()
            section = m.group(2).strip()
        else:
            buf.append(line)
    flush()
    return blocks


def _looks_like_heading(line: str) -> bool:
    line = line.strip()
    return (3 < len(line) < 70 and not line.endswith((".", ",", ";", ":")) and line[0].isupper()
            and len(line.split()) <= 9 and not re.match(r"^[-•*\d]", line))


def extract_pdf(data: bytes) -> list[dict]:
    """Page-by-page extraction; short title-like lines are treated as section headings."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    blocks: list[dict] = []
    section = None
    for i, page in enumerate(reader.pages, start=1):
        text = clean_text(page.extract_text() or "")
        if not text:
            continue
        buf: list[str] = []
        for line in text.split("\n"):
            if _looks_like_heading(line):
                if buf:
                    blocks.append({"text": clean_text("\n".join(buf)), "section": section, "page": i})
                    buf = []
                section = line.strip()
            else:
                buf.append(line)
        if buf:
            blocks.append({"text": clean_text("\n".join(buf)), "section": section, "page": i})
    # PDF lines are hard-wrapped: re-flow lines into paragraphs (keep list items on their own line)
    for b in blocks:
        b["text"] = re.sub(r"\n(?![-•*\d]+[.)]?\s)(?!\n)", " ", b["text"])
    return [b for b in blocks if b["text"]]


BOILERPLATE_TAGS = ["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "iframe", "svg", "button"]
BOILERPLATE_HINTS = re.compile(r"(nav|menu|footer|header|breadcrumb|sidebar|cookie|social|share|skip|banner|widget)", re.I)


def extract_html(html: str) -> tuple[str | None, list[dict]]:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(strip=True) if soup.title else None
    for tag in soup(BOILERPLATE_TAGS):
        tag.decompose()
    for tag in soup.find_all(attrs={"class": BOILERPLATE_HINTS}):
        tag.decompose()
    for tag in soup.find_all(attrs={"id": BOILERPLATE_HINTS}):
        tag.decompose()
    root = soup.find("main") or soup.find("article") or soup.body or soup
    blocks, section, buf = [], None, []

    def flush():
        if buf:
            t = clean_text("\n".join(buf))
            if len(t) > 30:
                blocks.append({"text": t, "section": section, "page": None})
            buf.clear()

    for el in root.find_all(["h1", "h2", "h3", "h4", "p", "li", "td", "dd", "pre"]):
        txt = el.get_text(" ", strip=True)
        if not txt:
            continue
        if el.name in ("h1", "h2", "h3", "h4"):
            flush()
            section = txt[:200]
        else:
            if el.name == "li":
                txt = "- " + txt
            buf.append(txt)
    flush()
    if not blocks:  # very unstructured page
        t = clean_text(root.get_text("\n", strip=True))
        if t:
            blocks = [{"text": t, "section": None, "page": None}]
    return title, blocks


def extract_docx(data: bytes) -> list[dict]:
    import docx

    d = docx.Document(io.BytesIO(data))
    blocks, section, buf = [], None, []
    for p in d.paragraphs:
        style = (p.style.name or "").lower() if p.style else ""
        if style.startswith("heading") and p.text.strip():
            if buf:
                blocks.append({"text": clean_text("\n".join(buf)), "section": section, "page": None})
                buf = []
            section = p.text.strip()
        elif p.text.strip():
            buf.append(p.text)
    if buf:
        blocks.append({"text": clean_text("\n".join(buf)), "section": section, "page": None})
    return blocks


def extract(data: bytes, ext: str) -> tuple[dict, list[dict]]:
    """Returns (metadata, blocks)."""
    ext = ext.lower()
    if ext == ".pdf":
        return {}, extract_pdf(data)
    if ext == ".docx":
        return {}, extract_docx(data)
    text = data.decode("utf-8", errors="replace")
    if ext in (".html", ".htm"):
        title, blocks = extract_html(text)
        return ({"title": title} if title else {}), blocks
    meta, body = parse_front_matter(text)
    if ext in (".md", ".markdown"):
        return meta, extract_markdown(body)
    # plain text: paragraphs, no sections
    return meta, [{"text": clean_text(body), "section": None, "page": None}]
