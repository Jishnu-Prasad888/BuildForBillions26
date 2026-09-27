"""Document understanding: what is physically present on the page?

This module runs *before* field detection and answers one question per text block: is this a title, a
section heading, an instruction, an example, static text, or a label that could have an input area next to
it?  Field detection (``detect.py``) then refuses to invent a field from anything classified as a title,
heading, instruction or example.

Every element keeps its page, bounding box, raw and normalised text, element type, confidence and its
neighbours, so the structured form schema can always be traced back to what was actually on the page.

Element types
    document_title  the form's name ("KNOW YOUR CLIENT (KYC) APPLICATION FORM")
    section_heading a group heading inside the form ("IDENTITY DETAILS")
    instruction     an imperative sentence telling the citizen what to do ("Please affix a photograph")
    example         an example or format hint ("for example 01/01/1990")
    help_text       parenthetical helper text belonging to a label ("(as per Aadhaar card)")
    field_label     a candidate label; it is only a *candidate* until an input area is found beside it
    static_text     anything else printed on the page (declarations, notes, footers)
    photo_area / signature_area / attachment_area   a box the citizen fills by hand or with a document
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.formdoc.extract import Token, cluster_rows, median_height

# --------------------------------------------------------------------------------------------- vocabularies
TITLE_WORDS = re.compile(r"\b(application|form|request|registration|proposal|statement|affidavit|"
                         r"certificate|return|schedule|annexure|appendix|sheet|slip|form)\b", re.I)
HEADING_WORDS = re.compile(r"\b(details?|particulars?|information|section|part|chapter|section\s+[ivx0-9]+|"
                           r"for\s+(the\s+)?(office|bank|official)\s+use|page\s*\d+|annexure|"
                           r"declaration|undertaking|signature|documents?|checklist)\b", re.I)
INSTRUCTION_VERB = re.compile(r"^\s*(please\s+)?(kindly\s+)?(note|fill|write|enter|provide|specify|tick|check|"
                              r"mark|attach|affix|paste|give|complete|sign|do\s+not|don't|mandatory|required|"
                              r"must|should|apply|select|choose|attach|paste|pass\s+on|carry|retain)\b", re.I)
INSTRUCTION_ANY = re.compile(r"\b(please\s+(affix|attach|fill|write|enter|provide|specify|tick|paste|sign|attach)|"
                             r"kindly\s+(fill|write|enter|attach)|do\s+not\s+use|mandatory|compulsory|"
                             r"is\s+mandatory|are\s+mandatory|required\s+field|as\s+per\s+instructions|"
                             r"failing\s+which|without\s+which|only\s+if|if\s+applicable|must\s+be\s+filled)", re.I)
EXAMPLE_HINT = re.compile(r"(e\.?g\.?|for\s+example|for\s+instance|such\s+as|sample\s+format|ex:\s*|like\s+this)", re.I)
#: An example is only an example when the hint frames it ("for example 01/01/1990"), not when it is a
#: parenthetical in the middle of a label ("Registration No. (e.g. CIN):").
EXAMPLE_FRAME = re.compile(r"^\W{0,2}(e\.?g\.?|for\s+example|for\s+instance|such\s+as|sample|like\s+this|ex\s*:)"
                           r"|(e\.?g\.?|for\s+example|for\s+instance|such\s+as)\s*[\]):.]?\s*$", re.I)
PARENTHETICAL = re.compile(r"^\s*[\(\[]")
PHOTO_WORDS = re.compile(r"\b(photograph|photograph|photo\s*graph|photo|picture|passport\s*size|"
                         r"recent\s+photo|affix|glue|paste)\b", re.I)
SIGNATURE_WORDS = re.compile(r"\b(signature|signed|sign\s+here|specimen|thumb\s*impression|"
                             r"authorised\s+signatory|authorized\s+signatory)\b", re.I)
ATTACHMENT_WORDS = re.compile(r"\b(attach(ment|ed)?|enclos\w*|document|proof|supporting|"
                              r"copy\s+of|upload|annexure|certificate|mark\s+sheets?)\b", re.I)
FOOTER_WORDS = re.compile(r"^\s*(page\s*\d+\s*(of\s*\d+)?|form\s*no|serial\s*no|for\s+office\s+use)", re.I)
NOISE_WORDS = re.compile(r"^(page\s*\d+|form\s*no\.?|serial\s*no\.?|version|ref(erence)?\.?\s*no\.?|date\s*$)", re.I)
OFFICE_USE = re.compile(r"(for\s+(the\s+)?(office|bank|official|branch|company|internal)\s+use|"
                        r"to\s+be\s+filled\s+(in\s+)?by\s+(the\s+)?(bank|branch|office|officer|official)|"
                        r"office\s+use|official\s+use|internal\s+use)", re.I)
OPTIONAL_WORDS = re.compile(r"\b(optional|if\s+available|if\s+applicable|where\s+applicable|if\s+any|"
                            r"not\s+mandatory|as\s+applicable)\b", re.I)
MANDATORY_WORDS = re.compile(r"(\*\s*$|mandatory|compulsory|required|is\s+required|mandatorily)", re.I)

ELEMENT_TYPES = (
    "document_title", "section_heading", "instruction", "example", "help_text", "field_label",
    "static_text", "photo_area", "signature_area", "attachment_area",
)
#: Elements that are printed text and can therefore never be a field label on their own.
NON_FIELD_ELEMENTS = {"document_title", "section_heading", "instruction", "example", "help_text", "static_text"}
#: The ones that are written as running prose, so a *part* of them is prose too.
PARAGRAPH_ELEMENTS = {"document_title", "instruction", "example"}
#: Classifications that a drawn input area is allowed to overrule. A title, an example or bracketed helper
#: text never becomes a field, whatever is printed next to it.
SOFT_ELEMENTS = {"section_heading", "instruction", "static_text"}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def normalize_text(text: str) -> str:
    """Whitespace/case tidy-up that does not change wording. The original text is always kept too."""
    t = re.sub(r"[ \t ]+", " ", (text or "")).strip()
    t = re.sub(r"\s+([,;:.])", r"\1", t)
    return t.strip(" \t\n")


def letters_ratio(text: str) -> float:
    body = re.sub(r"\s", "", text or "")
    if not body:
        return 0.0
    return sum(1 for c in body if c.isalpha()) / len(body)


# --------------------------------------------------------------------------------------------- blocks
@dataclass
class Block:
    """One visually continuous piece of text on the page (a line, or a run of wrapped lines)."""

    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    conf: float | None = None
    font_ratio: float = 1.0
    bold_ratio: float = 0.0
    centred: bool = False
    rows: int = 1
    ends_colon: bool = False
    band: int = 0

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def h(self) -> float:
        return self.y1 - self.y0

    @property
    def words(self) -> int:
        return len(self.text.split())

    @property
    def bbox(self) -> list[float]:
        return [self.x0, self.y0, self.x1, self.y1]


@dataclass
class Element:
    """A classified block of the page."""

    text: str
    normalized_text: str
    type: str
    page: int
    bbox: list[float]
    confidence: float
    font_ratio: float = 1.0
    label_bbox: list[float] = field(default_factory=list)
    section: str = ""
    reasons: list[str] = field(default_factory=list)
    related: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {"text": self.text, "normalized_text": self.normalized_text, "type": self.type, "page": self.page,
                "bbox": [round(v, 1) for v in self.bbox], "confidence": round(self.confidence, 2),
                "font_ratio": round(self.font_ratio, 2), "section": self.section, "reasons": self.reasons,
                "label_bbox": [round(v, 1) for v in self.label_bbox]}


@dataclass
class PageStructure:
    """Everything the document understanding step knows about one page."""

    page: int
    elements: list[Element] = field(default_factory=list)
    title: str = ""
    sections: list[dict] = field(default_factory=list)
    areas: list[dict] = field(default_factory=list)  # photo / signature / attachment boxes to fill by hand
    warnings: list[str] = field(default_factory=list)

    def by_type(self, *types: str) -> list[Element]:
        want = set(types)
        return [e for e in self.elements if e.type in want]

    def non_field_texts(self) -> set[str]:
        return {_norm(e.text) for e in self.elements if e.type in NON_FIELD_ELEMENTS}

    def rejected(self, text: str) -> str:
        """The element type that forbids ``text`` from being a label, or "" when nothing forbids it.

        The page's own reading of the text wins: if it *is* one of this page's printed elements (a title, a
        heading, an instruction, an example, a banner) it is never a label. Text that the page has not
        classified is then judged on its own wording, and only a *bare fragment* of running prose
        ("size photograph" out of "Please affix a recent passport size photograph") is refused. A real
        label that merely shares a paragraph with an instruction ("City/town/village:" in an address block
        that also says "mandatory for overseas applicants") is kept.
        """
        t = _norm(text)
        if not t:
            return ""
        bare = not re.search(r"[:：]\s*\**\s*$", (text or "").strip()) and len(text.split()) <= 4
        for e in self.elements:
            if e.type not in NON_FIELD_ELEMENTS:
                continue
            n = _norm(e.text)
            if not n:
                continue
            if t == n:
                return e.type
            if bare and e.type in PARAGRAPH_ELEMENTS and t in n:
                return e.type
        own, _conf, _reasons = text_type(text)
        return "" if own == "field_label" else own

    def area_at(self, bbox: list[float]) -> dict | None:
        """The photograph / signature / attachment box a point falls inside, if any."""
        cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
        for a in self.areas:
            x0, y0, x1, y1 = a["bbox"]
            if x0 <= cx <= x1 and y0 <= cy <= y1:
                return a
        return None


# --------------------------------------------------------------------------------------------- building blocks
def split_columns(row: list[Token], h: float) -> list[list[Token]]:
    """Split one text row wherever a horizontal gap is too wide to be a space.

    Forms print two or three unrelated things on the same baseline (\"A. IDENTITY DETAILS\" next to the
    photograph instruction, \"Name: ____\" next to \"DOB: ____\"). Reading the row as a single line is what
    made a heading look like the first half of a field label.
    """
    if not row:
        return []
    ordered = sorted(row, key=lambda t: t[0])
    gap = max(2.5 * h, 18.0)
    cols: list[list[Token]] = [[ordered[0]]]
    for t in ordered[1:]:
        if t[0] - cols[-1][-1][2] > gap:
            cols.append([t])
        else:
            cols[-1].append(t)
    return cols


def build_blocks(tokens: list[Token], h: float, page_w: float) -> list[Block]:
    """Group tokens into lines, then merge wrapped lines that belong to the same paragraph.

    A paragraph is a set of consecutive lines that share a left edge (within a character width) and are
    close enough vertically. Merging is what stops the middle of an instruction ("…passport / size
    photograph / and sign across it") from looking like three short labels.
    """
    lines: list[Block] = []
    for row in cluster_rows(tokens):
        for col in split_columns(row, h):
            text = " ".join(t[4] for t in col)
            confs = [t[5] for t in col if t[5] is not None]
            lines.append(Block(normalize_text(text), min(t[0] for t in col), min(t[1] for t in col),
                               max(t[2] for t in col), max(t[3] for t in col),
                               statistics_fmean(confs) if confs else None,
                               font_ratio=(sum(t[3] - t[1] for t in col) / len(col)) / max(h, 1e-6),
                               centred=abs(((min(t[0] for t in col) + max(t[2] for t in col)) / 2) - page_w / 2) < page_w * 0.12))
    blocks: list[Block] = []
    for _band, column in enumerate(_columns(lines, h)):
        merged: list[Block] = []
        for line in column:
            if merged:
                prev = merged[-1]
                gap = line.y0 - prev.y1
                no_break = not (line.ends_colon or prev.text.endswith((":", "：", ".", "?", ";")))
                starts_new = bool(re.match(r"^(\(?\d{1,2}[).:]|\(?[a-z][).]\s|[•\-–]\s)", line.text))
                # A heading never continues into the prose under it (or the reverse), and a fill-in line
                # ("Date: ____") is a field, never the middle of a paragraph.
                heading_edge = (_short_upper(prev.text) != _short_upper(line.text)
                                and (_short_upper(prev.text) or _short_upper(line.text)))
                fill_in = bool(_FILL_IN.search(prev.text) or _FILL_IN.search(line.text))
                # Wrapped lines sit about a fifth of a line apart, so anything much looser is a new block: a
                # big vertical jump, a sentence break, a bullet, a new number, a heading or a fill-in line.
                if not starts_new and no_break and not heading_edge and not fill_in and -0.4 * h <= gap <= 1.0 * h:
                    prev.text = normalize_text(prev.text + " " + line.text)
                    prev.x0, prev.x1 = min(prev.x0, line.x0), max(prev.x1, line.x1)
                    prev.y1 = max(prev.y1, line.y1)
                    prev.rows += 1
                    prev.conf = line.conf if line.conf is not None else prev.conf
                    continue
            line.ends_colon = bool(re.search(r"[:：]\s*\**\s*$", line.text))
            merged.append(line)
        blocks.extend(merged)
    blocks.sort(key=lambda b: (b.band, b.y0))
    for b in blocks:
        b.text = normalize_text(b.text)
        b.ends_colon = bool(re.search(r"[:：]\s*\**\s*$", b.text))
        b.bold_ratio = 0.0
    return blocks


_FILL_IN = re.compile(r"_{3,}|\.{5,}")


def _short_upper(text: str) -> bool:
    """A short ALL-CAPS line: the shape of a heading ("A. IDENTITY DETAILS"), not of running text."""
    return len(text.split()) <= 8 and _is_upper(text)


def _columns(lines: list[Block], h: float) -> list[list[Block]]:
    """Group lines into vertical columns by their left edge, so wrapping is judged inside a column.

    Without this, the caption printed inside a photograph box never merges with the instruction above it,
    because a heading in the left column sits between the two in reading order.
    """
    reps: list[float] = []
    for line in sorted(lines, key=lambda l: l.x0):
        for i, rep in enumerate(reps):
            if line.x0 - rep <= 3 * h:
                break
        else:
            reps.append(line.x0)
            i = len(reps) - 1
        line.band = i
    return [sorted((l for l in lines if l.band == i), key=lambda l: l.y0) for i in range(len(reps))]


def statistics_fmean(values: list[float]) -> float:
    return sum(values) / len(values)


def _is_upper(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    return bool(letters) and sum(1 for c in letters if c.isupper()) / len(letters) >= 0.85


def _is_sentence(text: str) -> bool:
    """A sentence-like block: several words, few capitals, ends with a full stop or a verb phrase."""
    words = text.split()
    if not words or len(words) > 18:
        return False
    if text.endswith((".", ";", "!", ":")) and len(words) >= 4:
        return True
    return bool(INSTRUCTION_VERB.match(text) and len(words) >= 2)


# --------------------------------------------------------------------------------------------- classification
def text_type(text: str, *, conf: float = 0.9, font_ratio: float = 1.0, has_input_below: bool = False,
              is_first_page: bool = False, top_third: bool = False) -> tuple[str, float, list[str]]:
    """Classify a piece of text on its wording and shape. Returns (element type, confidence, reasons).

    ``has_input_below`` is the one geometric hint this function needs: the same wording means a field label
    when the page draws an input area under it, and printed prose when it does not. Detection calls this
    for every candidate label, so a title, a heading, an instruction, an example or helper text can never
    become a field just because a line happens to sit near a ruled line somewhere else on the page.
    """
    text = normalize_text(text)
    reasons: list[str] = []
    colon = bool(re.search(r"[:：]\s*\**\s*$", text))
    words = text.split()
    big = font_ratio >= 1.15
    small = font_ratio <= 0.9
    upper = _is_upper(text)
    title_words = bool(TITLE_WORDS.search(text))
    instruction = bool(INSTRUCTION_ANY.search(text) or INSTRUCTION_VERB.match(text))
    example = bool(EXAMPLE_HINT.search(text)) and bool(EXAMPLE_FRAME.search(text)) and not colon
    parenthetical = bool(PARENTHETICAL.match(text))
    office_only = bool(OFFICE_USE.search(text))
    sentence = _is_sentence(text)

    if not words:
        return "static_text", 0.2, ["no words"]
    if NOISE_WORDS.match(text) and len(words) <= 4:
        return "static_text", 0.9, ["page furniture"]

    # 1. document title: the form's own name, at the top of the first page
    if is_first_page and top_third and title_words and not instruction and not parenthetical \
            and (big or upper):
        return "document_title", (0.95 if big and upper else 0.85), ["line names the form, at the top of page 1"]

    # 2. helper text and examples printed for the citizen to read
    if parenthetical:
        return "help_text", 0.85, ["bracketed helper text"]
    if example and not colon:
        return "example", 0.85, ["example / format hint"]

    # 3. instructions: imperatives, mandatory notes, or prose with no input area under it
    if instruction:
        return "instruction", 0.9, ["imperative / mandatory wording"]
    if sentence and not colon and not upper and len(words) >= 4 and not has_input_below:
        return "instruction", 0.7, ["sentence with no input area below it"]

    # 4. section heading: a short capitalised or large line that introduces a group of fields
    if (upper or big) and not colon and len(words) <= 8:
        if HEADING_WORDS.search(text):
            return "section_heading", 0.9, ["short capitalised line introducing a group of fields"]
        if upper and len(words) <= 4 and not has_input_below:
            return "section_heading", 0.7, ["short capitalised line with no input area"]
        if upper and len(words) > 6:
            return "static_text", 0.5, ["long capitalised run of text, treated as body text"]
    if big and not colon and len(words) <= 4 and HEADING_WORDS.search(text):
        return "section_heading", 0.8, ["larger line introducing a group of fields"]

    # 5. office-use banners, footers, all-capitals text with nothing to fill in
    if office_only:
        return "static_text", 0.8, ["office-use text"]
    if upper and not colon and not has_input_below and len(words) >= 2:
        return "static_text", 0.6, ["capitalised line with no input area"]
    # A label like "Name:" is a sentence fragment, not prose: it stays a label candidate.
    if not colon and sentence and len(words) >= 5:
        return "static_text", 0.55, ["reads as a sentence"]
    if not colon and len(words) > 12 and not has_input_below:
        return "static_text", 0.6, ["long printed text with no input area"]

    # 6. otherwise it is still only a *candidate* label
    c = min(max(conf, 0.05), 0.99)
    if small and not parenthetical:
        c = min(c, 0.75)
    return "field_label", c, ["no title, heading, instruction or example markers"]


def classify_block(b: Block, page: int, h: float, is_first_page: bool, page_w: float, page_h: float,
                   has_input_below: bool = False) -> Element:
    """Classify one block of the page, using the shared text rules plus the block's geometry."""
    etype, conf, reasons = text_type(
        b.text, conf=b.conf if b.conf is not None else 0.9, font_ratio=b.font_ratio,
        has_input_below=has_input_below, is_first_page=is_first_page, top_third=b.y0 <= 0.34 * page_h)
    return Element(text=b.text, normalized_text=normalize_text(b.text), type=etype, page=page, bbox=b.bbox,
                   confidence=round(conf, 2), font_ratio=b.font_ratio, reasons=reasons)


# --------------------------------------------------------------------------------------------- areas
def find_areas(blocks: list[Element], boxes: list[tuple[float, float, float, float]], h: float
               ) -> list[dict]:
    """Photo, signature and attachment boxes: an empty rectangle whose nearby text says what it is for.

    An area is never turned into a text field; it becomes a field of type photograph / signature /
    attachment that the citizen satisfies by hand, and that the PDF step leaves alone.
    """
    out: list[dict] = []
    for (x0, y0, x1, y1) in boxes:
        w, hh = x1 - x0, y1 - y0
        if w < 2.2 * h or hh < 1.4 * h:
            continue
        if w > 6.5 * h and hh < 2.2 * h:
            continue  # a long thin box is a blank, not an area
        if hh < 2.6 * h:
            continue  # an ordinary input box is about one line tall; areas for a photo or a signature are taller
        # Distance is measured from the box's edge, not its centre: the caption under a 100pt-tall photograph
        # box is close to the box even though it is far from the middle of it.
        near = [e for e in blocks
                if e.type in ("instruction", "field_label", "static_text", "help_text")
                and _near_box([x0, y0, x1, y1], e.bbox, h)]
        if not near:
            continue
        joined = " ".join(e.text for e in sorted(near, key=lambda e: e.bbox[1]))
        if PHOTO_WORDS.search(joined) and not SIGNATURE_WORDS.search(joined):
            kind, conf, words = "photograph", 0.8, PHOTO_WORDS
        elif SIGNATURE_WORDS.search(joined):
            kind, conf, words = "signature", 0.85, SIGNATURE_WORDS
        elif ATTACHMENT_WORDS.search(joined):
            kind, conf, words = "attachment", 0.7, ATTACHMENT_WORDS
        else:
            continue
        # The label is the nearest text that actually names the area, not just any text in reach.
        named = [e for e in near if words.search(e.text)] or near
        label = min(named, key=lambda e: _box_gap([x0, y0, x1, y1], e.bbox)).text[:120]
        out.append({"kind": kind, "bbox": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
                    "confidence": conf, "label": label})
    # one area per region: keep the most confident
    out.sort(key=lambda a: (a["bbox"][0], a["bbox"][1]))
    kept: list[dict] = []
    for a in out:
        if any(_iou(a["bbox"], k["bbox"]) > 0.4 for k in kept):
            continue
        kept.append(a)
    return kept


def _box_gap(box: list[float], bbox: list[float]) -> float:
    """Distance between two rectangles, as the sum of the horizontal and vertical gaps (0 when they touch)."""
    return max(box[0] - bbox[2], bbox[0] - box[2], 0.0) + max(box[1] - bbox[3], bbox[1] - box[3], 0.0)


def _near_box(box: list[float], bbox: list[float], h: float, reach: float = 3.0) -> bool:
    """Is ``bbox`` within ``reach`` text-heights of the rectangle ``box`` on both axes?"""
    dx = max(box[0] - bbox[2], bbox[0] - box[2], 0.0)
    dy = max(box[1] - bbox[3], bbox[1] - box[3], 0.0)
    return dx <= reach * h and dy <= reach * h


def _iou(a: list[float], b: list[float]) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    if inter <= 0:
        return 0.0
    area_a = (a[2] - a[0]) * (a[3] - a[1]) or 1
    area_b = (b[2] - b[0]) * (b[3] - b[1]) or 1
    return inter / min(area_a, area_b)


# --------------------------------------------------------------------------------------------- entry point
def analyze_page(page: int, tokens: list[Token], boxes: list[tuple[float, float, float, float]],
                 page_w: float, page_h: float, is_first_page: bool = True) -> PageStructure:
    """Classify one page. ``boxes`` are the page's hollow rectangles in the page's own coordinates."""
    out = PageStructure(page=page)
    h = median_height(tokens)
    if not tokens or h <= 0:
        return out
    blocks = build_blocks(tokens, h, page_w)
    # Does the page show an input area under this block? Used to tell a label from printed prose.
    elements: list[Element] = []
    for b in blocks:
        below = any(by0 > b.y1 and by0 - b.y1 <= 2.6 * h for by0, by1 in
                    [(min(by0, by1), max(by0, by1)) for (bx0, by0, bx1, by1) in boxes])
        e = classify_block(b, page, h, is_first_page, page_w, page_h, has_input_below=below)
        elements.append(e)
    # The first page's title is the topmost document_title; the other pages' titles are page furniture.
    titles = [e for e in elements if e.type == "document_title"]
    if is_first_page and titles:
        best = max(titles, key=lambda e: (e.bbox[1] == min(t.bbox[1] for t in titles), e.confidence))
        out.title = best.text
        for e in titles:
            if e is not best:
                e.type, e.confidence = "static_text", 0.7
    out.elements = elements
    out.areas = find_areas(elements, list(boxes), h)
    out.sections = _sections(elements, h)
    for e in elements:
        e.section = _section_of(e, out.sections, h)
    return out


def _sections(elements: list[Element], h: float) -> list[dict]:
    """Headings in reading order; a heading owns everything below it until the next heading."""
    heads = [e for e in elements if e.type == "section_heading"]
    heads.sort(key=lambda e: (e.bbox[1], e.bbox[0]))
    seen: set[str] = set()
    sections: list[dict] = []
    for e in heads:
        name = e.text[:120]
        key = _norm(name)
        if not key or key in seen:
            continue
        seen.add(key)
        sections.append({"name": name, "page": e.page, "bbox": [round(v, 1) for v in e.bbox], "order": len(sections) + 1})
    return sections


def _section_of(e: Element, sections: list[dict], h: float) -> str:
    best = ""
    for s in sections:
        if s["page"] < e.page:
            continue
        sy = s["bbox"][1]
        if s["page"] == e.page and sy <= e.bbox[1] + 1.5 * h:
            best = s["name"]
        elif s["page"] > e.page:
            break
    return best
