"""Convert KAG markdown answer to Telegram HTML and build source summaries."""
from __future__ import annotations

import html
import re

CITE_RE = re.compile(r'\[(?:chunk|fact)_[a-z0-9_]+(?:,\s*(?:chunk|fact)_[a-z0-9_]+)*\]')
BOLD_RE = re.compile(r'\*\*(.+?)\*\*')
ITALIC_RE = re.compile(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)')
HEADING_RE = re.compile(r'^#{1,3}\s+(.+)$')

MAX_LEN = 4000  # Telegram hard limit is 4096; stay conservative


def kag_to_html(text: str) -> str:
    """Convert KAG markdown answer to Telegram HTML, stripping citation markers."""
    lines: list[str] = []
    for raw in text.split('\n'):
        line = CITE_RE.sub('', raw).rstrip()
        if not line:
            lines.append('')
            continue
        # Escape HTML first
        line = html.escape(line)
        # Headings → bold
        m = HEADING_RE.match(line)
        if m:
            lines.append(f'<b>{m.group(1)}</b>')
            continue
        # Blockquote lines
        if line.startswith('&gt; '):
            lines.append(f'<i>{line[5:]}</i>')
            continue
        # Bold
        line = BOLD_RE.sub(r'<b>\1</b>', line)
        # Single-star italic (not inside bold)
        line = ITALIC_RE.sub(r'<i>\1</i>', line)
        # Underscore italic
        line = re.sub(r'_([^_\n]+?)_', r'<i>\1</i>', line)
        lines.append(line)

    result = '\n'.join(lines)
    # Collapse 3+ consecutive newlines to 2
    result = re.sub(r'\n{3,}', '\n\n', result).strip()
    if len(result) > MAX_LEN:
        result = result[:MAX_LEN - 20] + '\n\n<i>…(truncated)</i>'
    return result


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
            line += f'\n   {title}'
        if section:
            line += f' · {section}'
        lines.append(line)
    return '\n'.join(lines)


def format_evidence_detail(evidence: list[dict]) -> str:
    """Full evidence detail for the 'Show Evidence' callback."""
    if not evidence:
        return 'No evidence chunks available.'
    parts: list[str] = ['<b>📚 Evidence Chunks</b>\n']
    for i, e in enumerate(evidence[:8], 1):
        pub = html.escape(e.get('publisher') or e.get('source_title') or 'Source')
        title = html.escape(e.get('source_title') or '')
        section = html.escape(e.get('section') or '')
        chunk_id = html.escape(e.get('id', ''))
        text_snippet = html.escape((e.get('text') or '')[:300])
        if len(e.get('text', '')) > 300:
            text_snippet += '…'
        header = f'<b>{i}. {pub}</b>'
        if title and title != pub:
            header += f'\n   {title}'
        if section:
            header += f' · {section}'
        if chunk_id:
            header += f'\n   <code>{chunk_id}</code>'
        parts.append(header)
        if text_snippet:
            parts.append(f'<i>{text_snippet}</i>')
        parts.append('')
    result = '\n'.join(parts).strip()
    if len(result) > MAX_LEN:
        result = result[:MAX_LEN - 20] + '\n<i>…(truncated)</i>'
    return result
