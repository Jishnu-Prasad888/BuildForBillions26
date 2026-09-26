"""Convert KAG markdown answers to Telegram HTML, split long replies and build source summaries."""
from __future__ import annotations

import html
import re

CITE_RE = re.compile(r'\s*\[(?:chunk|fact)_[a-z0-9_]+(?:,\s*(?:chunk|fact)_[a-z0-9_]+)*\]')
BOLD_RE = re.compile(r'\*\*(.+?)\*\*')
ITALIC_RE = re.compile(r'(?<![*\w])\*(?![*\s])(.+?)(?<![*\s])\*(?![*\w])')
UNDERSCORE_ITALIC_RE = re.compile(r'(?<!\w)_(?!\s)([^_\n]+?)(?<!\s)_(?!\w)')
CODE_RE = re.compile(r'`([^`\n]+)`')
LINK_RE = re.compile(r'\[([^\]\n]+)\]\((https?://[^)\s]+)\)')
HEADING_RE = re.compile(r'^#{1,6}\s+(.+)$')
BULLET_RE = re.compile(r'^(\s*)[-*•]\s+')

MAX_LEN = 4000  # Telegram hard limit is 4096; stay conservative


def _inline(line: str) -> str:
    """Escape one line and convert inline markdown (links, code, bold, italic) to Telegram HTML."""
    links: list[str] = []

    def keep_link(m: re.Match) -> str:
        links.append(f'<a href="{html.escape(m.group(2), quote=True)}">{html.escape(m.group(1))}</a>')
        return f'\x00{len(links) - 1}\x00'

    line = LINK_RE.sub(keep_link, line)
    line = html.escape(line, quote=False)
    line = CODE_RE.sub(r'<code>\1</code>', line)
    line = BOLD_RE.sub(r'<b>\1</b>', line)
    line = ITALIC_RE.sub(r'<i>\1</i>', line)
    line = UNDERSCORE_ITALIC_RE.sub(r'<i>\1</i>', line)
    return re.sub(r'\x00(\d+)\x00', lambda m: links[int(m.group(1))], line)


def kag_to_html(text: str) -> str:
    """Convert a KAG markdown answer to Telegram HTML, stripping citation markers."""
    lines: list[str] = []
    for raw in text.split('\n'):
        line = CITE_RE.sub('', raw).rstrip()
        if not line.strip():
            lines.append('')
            continue
        m = HEADING_RE.match(line.strip())
        if m:
            lines.append(f'<b>{_inline(m.group(1).strip("* "))}</b>')
            continue
        if line.lstrip().startswith('>'):
            quote = BULLET_RE.sub('', line.lstrip()[1:].strip())
            lines.append(f'<i>“{_inline(quote)}”</i>')
            continue
        m = BULLET_RE.match(line)
        if m:
            indent = '   ' if m.group(1) else ''
            lines.append(f'{indent}• {_inline(line[m.end():])}')
            continue
        lines.append(_inline(line))

    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()


def split_message(text: str, limit: int = MAX_LEN) -> list[str]:
    """Split Telegram HTML into messages under ``limit`` at paragraph, then line, boundaries.
    Tags never span lines in ``kag_to_html`` output, so line boundaries are always safe."""
    parts: list[str] = []
    current = ''
    for para in text.split('\n\n'):
        pieces = [para] if len(para) <= limit else para.split('\n')
        for piece in pieces:
            sep = '\n\n' if piece is para else '\n'
            if current and len(current) + len(sep) + len(piece) > limit:
                parts.append(current)
                current = ''
            current = f'{current}{sep}{piece}' if current else piece
            while len(current) > limit:  # a single overlong line: hard cut
                parts.append(current[:limit])
                current = current[limit:]
    if current:
        parts.append(current)
    return parts or ['']


def format_sources(evidence: list[dict]) -> str:
    """Build a compact sources footer for a Telegram message."""
    if not evidence:
        return ''
    seen: list[dict] = []
    seen_ids: set[str] = set()
    for e in evidence:
        eid = e.get('id', '')
        if eid not in seen_ids:
            seen_ids.add(eid)
            seen.append(e)
    lines = [f'\n\n🔎 <b>Sources used: {len(seen)}</b>']
    for i, e in enumerate(seen[:5], 1):
        pub = html.escape(e.get('publisher') or e.get('source_title') or 'Source')
        title = html.escape(e.get('source_title') or '')
        section = html.escape(e.get('section') or '')
        line = f'{i}. {pub}'
        if title and title != pub:
            line += f' — {title}'
        if section:
            line += f' · {section}'
        lines.append(line)
    if len(seen) > 5:
        lines.append(f'… +{len(seen) - 5}')
    return '\n'.join(lines)


def format_evidence_detail(evidence: list[dict]) -> str:
    """Full evidence detail for the 'Show Evidence' callback."""
    if not evidence:
        return 'No evidence chunks available.'
    parts: list[str] = ['<b>📚 Evidence Chunks</b>\n']
    for i, e in enumerate(evidence[:12], 1):
        pub = html.escape(e.get('publisher') or e.get('source_title') or 'Source')
        title = html.escape(e.get('source_title') or '')
        section = html.escape(e.get('section') or '')
        chunk_id = html.escape(e.get('id', ''))
        text_snippet = html.escape(' '.join((e.get('text') or '')[:300].split()))
        if len(e.get('text', '')) > 300:
            text_snippet += '…'
        header = f'<b>{i}. {pub}</b>'
        if title and title != pub:
            header += f'\n   {title}'
        if section:
            header += f' · {section}'
        url = e.get('url')
        if url and url.startswith(('http://', 'https://')):
            header += f'\n   <a href="{html.escape(url, quote=True)}">{html.escape(url)}</a>'
        if e.get('is_demo'):
            header += '\n   <i>DEMO summary — confirm on the official portal</i>'
        if chunk_id:
            header += f'\n   <code>{chunk_id}</code>'
        parts.append(header)
        if text_snippet:
            parts.append(f'<i>{text_snippet}</i>')
        parts.append('')
    return '\n'.join(parts).strip()
