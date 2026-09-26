"""Paragraph-aware chunking that keeps section/page provenance."""
from __future__ import annotations

import re

TARGET_CHARS = 900
OVERLAP_CHARS = 150


def _split_long(text: str, size: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?।])\s+", text)
    out, cur = [], ""
    for s in sentences:
        if len(cur) + len(s) + 1 > size and cur:
            out.append(cur.strip())
            cur = ""
        while len(s) > size:  # pathological long sentence
            out.append(s[:size])
            s = s[size:]
        cur += " " + s
    if cur.strip():
        out.append(cur.strip())
    return out


def chunk_blocks(blocks: list[dict], target: int = TARGET_CHARS, overlap: int = OVERLAP_CHARS) -> list[dict]:
    chunks: list[dict] = []
    for block in blocks:
        paras = [p.strip() for p in re.split(r"\n\s*\n", block["text"]) if p.strip()]
        pieces: list[str] = []
        for p in paras:
            pieces += _split_long(p, target) if len(p) > target else [p]
        cur = ""
        for piece in pieces:
            if cur and len(cur) + len(piece) + 2 > target:
                chunks.append({"text": cur, "section": block.get("section"), "page": block.get("page")})
                tail = cur[-overlap:]
                cur = (tail[tail.find(" ") + 1 :] if " " in tail else "") + "\n\n" + piece
            else:
                cur = f"{cur}\n\n{piece}" if cur else piece
        if cur.strip():
            chunks.append({"text": cur.strip(), "section": block.get("section"), "page": block.get("page")})
    # prepend the section heading to improve retrieval of short chunks
    for c in chunks:
        c["embed_text"] = f"{c['section']}\n{c['text']}" if c.get("section") else c["text"]
    return chunks
