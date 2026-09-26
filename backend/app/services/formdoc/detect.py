"""Form structure detection from text tokens + page geometry (heuristics only, no model).

Everything is in one coordinate space per page (PDF points, or pixels for photos).
Nothing is invented: a field is only produced when the page shows evidence for it
(a blank, a ruled line, a rectangle or a tick box next to a label).
"""
from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field

from app.services.formdoc.extract import Token, cluster_rows, median_height

TYPES = {"text", "name", "multiline", "date", "phone", "email", "identity_number", "bank_account", "ifsc", "pincode",
         "amount", "number", "choice", "checkbox", "signature"}

BOX_GLYPHS = "□☐☑☒❏❑▢◻⬜■○◯◌"
_GLYPH_ONLY = re.compile(rf"^(?:\[\s*[xX✓✔]?\s*\]|\(\s*[xX✓✔]?\s*\)|[{BOX_GLYPHS}])$")
_GLYPH_LEAD = re.compile(rf"^([{BOX_GLYPHS}]|\[\s?\]|\(\s?\))(.+)$")
_BLANK_TOKEN = re.compile(r"^[_\.\-–—•·…\s]{3,}$")
_DATE_BLANK = re.compile(r"^[_\s]*[/\-][_\s]*[/\-]?[_\s]*(?:[/\-][_\s]*)?$")
_INLINE_BLANK = re.compile(r"(_{3,}|\.{5,}|…{2,}|-{6,})")
_LETTER = re.compile(r"[^\W\d_]")

TYPE_RULES: list[tuple[str, re.Pattern]] = [(t, re.compile(p, re.I)) for t, p in [
    ("signature", r"signature|sign(ed)? here|thumb\s*impression|हस्ताक्षर|ಸಹಿ"),
    ("email", r"e-?mail"),
    ("ifsc", r"\bifsc\b"),
    ("bank_account", r"account\s*(no|number|num|#)|\ba/c\b|खाता\s*(संख्या|नंबर)"),
    ("pincode", r"pin\s*-?code|postal\s*code|\bzip\b|पिन"),
    ("phone", r"phone|mobile|contact\s*(no|number)|\btel\b|whatsapp|मोबाइल|फोन|ಮೊಬೈಲ್"),
    ("identity_number", r"aadhaar|aadhar|uidai|\bpan\b|voter|passport|driving\s*licen|licen[cs]e\s*(no|number)|\bepic\b|ration\s*card|(identity|id)\s*(no|number|proof no)|आधार|ಆಧಾರ್"),
    ("date", r"\bdate\b|\bdob\b|d\.o\.b|birth|dd\s*/\s*mm|दिनांक|तारीख|जन्म|ದಿನಾಂಕ"),
    ("amount", r"amount|income|salary|\bfees?\b|₹|\brs\b|rupees"),
    ("number", r"\bage\b|number of|no\.? of|\barea\b|acres?|hectares?|quantity|\byears?\b"),
    ("multiline", r"address|remarks?|description|details|reason|comments?|पता|ವಿಳಾಸ"),
    ("name", r"\bname\b|नाम|ಹೆಸರು"),
]]
MULTI_SELECT = re.compile(r"select all|all that apply|any of|tick all|check all|documents? (attached|enclosed)|enclosures?", re.I)


def infer_type(label: str, default: str = "text") -> str:
    for t, rx in TYPE_RULES:
        if rx.search(label):
            return t
    return default


def clean_label(text: str) -> str:
    t = re.sub(r"\s+", " ", text).strip()
    t = re.sub(r"^\(?\d{1,2}[\).:]\s*|^\(?[a-z][\).]\s+", "", t, flags=re.I)  # "1." "(a)"
    t = t.strip(" :：_*«＊-–—.·")
    return t.strip()


def is_required(text: str, ftype: str) -> bool:
    if ftype == "signature":
        return False
    if re.search(r"\boptional\b", text, re.I):
        return False
    return True


@dataclass
class Seg:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    conf: float | None = None
    blank: bool = False
    date_blank: bool = False
    used: bool = False

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def h(self) -> float:
        return self.y1 - self.y0

    @property
    def bbox(self) -> list[float]:
        return [self.x0, self.y0, self.x1, self.y1]


@dataclass
class Box:
    x0: float
    y0: float
    x1: float
    y1: float
    glyph: bool = False
    used: bool = False

    @property
    def w(self) -> float:
        return self.x1 - self.x0

    @property
    def h(self) -> float:
        return self.y1 - self.y0

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def bbox(self) -> list[float]:
        return [self.x0, self.y0, self.x1, self.y1]


@dataclass
class Opt:
    label: str
    box: Box
    seg: Seg


def _r(v: list[float]) -> list[float]:
    return [round(float(x), 1) for x in v]


def _overlap_x(a0, a1, b0, b1) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def _iou_or_contain(a: list[float], b: list[float]) -> float:
    ix = _overlap_x(a[0], a[2], b[0], b[2])
    iy = _overlap_x(a[1], a[3], b[1], b[3])
    inter = ix * iy
    if inter <= 0:
        return 0.0
    area_a = (a[2] - a[0]) * (a[3] - a[1]) or 1
    area_b = (b[2] - b[0]) * (b[3] - b[1]) or 1
    return inter / min(area_a, area_b)


# --------------------------------------------------------------------------- tokens -> segments
def _glyph_boxes(tokens: list[Token], h: float) -> tuple[list[Token], list[Box]]:
    """Tick-box glyphs ("□", "[ ]", "☐Male") become boxes; other tokens are kept."""
    keep: list[Token] = []
    boxes: list[Box] = []
    for x0, y0, x1, y1, text, conf in tokens:
        if _GLYPH_ONLY.match(text):
            boxes.append(Box(x0, y0, x1, y1, glyph=True))
            continue
        m = _GLYPH_LEAD.match(text)
        if m and len(text) > 1:
            gw = min(x1 - x0, max(h * 0.9, (x1 - x0) * len(m.group(1)) / len(text)))
            boxes.append(Box(x0, y0, x0 + gw, y1, glyph=True))
            keep.append((x0 + gw, y0, x1, y1, m.group(2), conf))
            continue
        keep.append((x0, y0, x1, y1, text, conf))
    return keep, boxes


def build_segments(tokens: list[Token], boxes: list[Box], h: float) -> list[Seg]:
    segs: list[Seg] = []
    for row in cluster_rows(tokens):
        cur: list[Token] = []

        def flush():
            nonlocal cur
            if cur:
                text = " ".join(t[4] for t in cur)
                confs = [t[5] for t in cur if t[5] is not None]
                segs.append(Seg(text, min(t[0] for t in cur), min(t[1] for t in cur), max(t[2] for t in cur), max(t[3] for t in cur),
                                statistics.fmean(confs) if confs else None))
            cur = []

        for t in row:
            is_blank = bool(_BLANK_TOKEN.match(t[4])) or bool(_DATE_BLANK.match(t[4]) and len(t[4]) >= 4)
            if is_blank:
                flush()
                segs.append(Seg(t[4], t[0], t[1], t[2], t[3], t[5], blank=True, date_blank=bool(_DATE_BLANK.match(t[4]) and "/" in t[4] or "-" in t[4] and _DATE_BLANK.match(t[4]))))
                continue
            if cur:
                prev = cur[-1]
                gap = t[0] - prev[2]
                between_box = any(b.x0 >= prev[2] - 2 and b.x1 <= t[0] + 2 and b.y0 < prev[3] and b.y1 > prev[1] for b in boxes)
                if gap > 1.6 * h or between_box:
                    flush()
            cur.append(t)
        flush()
    # inline blanks glued to text: "Name:______"
    out: list[Seg] = []
    for s in segs:
        if s.blank or not _INLINE_BLANK.search(s.text):
            out.append(s)
            continue
        n = max(len(s.text), 1)
        cw = (s.x1 - s.x0) / n
        pos = 0
        for m in _INLINE_BLANK.finditer(s.text):
            if m.start() > pos and s.text[pos:m.start()].strip():
                out.append(Seg(s.text[pos:m.start()].strip(), s.x0 + pos * cw, s.y0, s.x0 + m.start() * cw, s.y1, s.conf))
            out.append(Seg(m.group(0), s.x0 + m.start() * cw, s.y0, s.x0 + m.end() * cw, s.y1, s.conf, blank=True))
            pos = m.end()
        if pos < n and s.text[pos:].strip():
            out.append(Seg(s.text[pos:].strip(), s.x0 + pos * cw, s.y0, s.x1, s.y1, s.conf))
    return out


# --------------------------------------------------------------------------- options / choice groups
def _extract_options(segs: list[Seg], boxes: list[Box], h: float) -> list[Opt]:
    opts: list[Opt] = []
    for b in boxes:
        best, best_gap = None, 1e9
        for s in segs:
            if s.blank or s.used:
                continue
            gap = s.x0 - b.x1
            if gap < -0.4 * h or gap > 1.8 * h:
                continue
            if abs(s.cy - b.cy) > max(0.65 * b.h, 0.65 * s.h):
                continue
            if gap < best_gap:
                best, best_gap = s, gap
        if best is not None:
            opts.append(Opt(clean_label(best.text), b, best))
    # one segment can only label one box (the closest)
    seen: dict[int, Opt] = {}
    for o in sorted(opts, key=lambda o: o.seg.x0 - o.box.x1):
        seen.setdefault(id(o.seg), o)
    return [o for o in seen.values() if o.label]


def _group_options(opts: list[Opt], segs: list[Seg], h: float) -> list[tuple[list[Opt], Seg | None]]:
    """Cluster options into groups; returns [(options, label_segment_or_None)]."""
    if not opts:
        return []
    rows: list[list[Opt]] = []
    for o in sorted(opts, key=lambda o: (o.box.cy, o.box.x0)):
        for r in rows:
            if abs(r[0].box.cy - o.box.cy) <= 0.7 * h:
                r.append(o)
                break
        else:
            rows.append([o])
    row_groups: list[tuple[list[Opt], Seg | None]] = []
    for r in rows:
        r.sort(key=lambda o: o.box.x0)
        cur = [r[0]]
        lab: Seg | None = None
        for o in r[1:]:
            prev = cur[-1]
            # a label between two options starts a new group ("Gender: [] M [] F   Marital: [] Y [] N")
            between = [s for s in segs if not s.blank and not s.used and s.x0 >= prev.seg.x1 - 1 and s.x1 <= o.box.x0 + 1
                       and abs(s.cy - o.box.cy) <= 0.7 * h and s is not prev.seg and s is not o.seg]
            if between:
                row_groups.append((cur, lab))
                cur, lab = [o], max(between, key=lambda s: s.x1)
            else:
                cur.append(o)
        row_groups.append((cur, lab))
    # stacked rows aligned on the same left edge belong together
    merged: list[tuple[list[Opt], Seg | None]] = []
    for grp, lab in sorted(row_groups, key=lambda g: (g[0][0].box.cy, g[0][0].box.x0)):
        last = merged[-1] if merged else None
        if last and lab is None:
            prev_opts = last[0]
            prev_row_y = max(o.box.cy for o in prev_opts)
            if 0 < grp[0].box.cy - prev_row_y <= 2.7 * h and abs(grp[0].box.x0 - prev_opts[-1].box.x0) <= 0.8 * h \
                    or (0 < grp[0].box.cy - prev_row_y <= 2.7 * h and abs(grp[0].box.x0 - min(o.box.x0 for o in prev_opts)) <= 0.8 * h):
                prev_opts.extend(grp)
                continue
        merged.append((list(grp), lab))
    return merged


def _find_group_label(opts: list[Opt], segs: list[Seg], h: float, preset: Seg | None) -> Seg | None:
    if preset is not None:
        return preset
    first = min(opts, key=lambda o: (round(o.box.cy / h), o.box.x0))
    used_ids = {id(o.seg) for o in opts}
    left = [s for s in segs if not s.blank and not s.used and id(s) not in used_ids and s.x1 <= first.box.x0 + 0.3 * h
            and abs(s.cy - first.box.cy) <= 0.7 * h and first.box.x0 - s.x1 <= 12 * h]
    if left:
        return max(left, key=lambda s: s.x1)
    above = [s for s in segs if not s.blank and not s.used and id(s) not in used_ids and 0.2 * h <= first.box.y0 - s.y1 <= 2.8 * h
             and s.x0 <= first.box.x0 + 2.5 * h and s.x1 >= first.box.x0 - h * 0.5 or
             (not s.blank and not s.used and id(s) not in used_ids and 0.2 * h <= first.box.y0 - s.y1 <= 2.8 * h and s.text.rstrip().endswith((":", "?")))]
    if above:
        above.sort(key=lambda s: (not s.text.rstrip().endswith((":", "?")), first.box.y0 - s.y1))
        return above[0]
    return None


# --------------------------------------------------------------------------- main entry
@dataclass
class PageStructure:
    fields: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _comb_clusters(boxes: list[Box], h: float) -> tuple[list[Box], list[Box]]:
    """Rows of >=4 adjacent small squares are one character-comb input (e.g. a 12 cell Aadhaar box)."""
    small = [b for b in boxes if 0.5 * h <= b.w <= 2.6 * h and 0.5 * h <= b.h <= 2.6 * h and 0.7 <= b.w / max(b.h, 1e-6) <= 1.4]
    small.sort(key=lambda b: (round(b.cy / max(h * 0.6, 1)), b.x0))
    combs: list[Box] = []
    in_comb: set[int] = set()
    i = 0
    while i < len(small):
        run = [small[i]]
        j = i + 1
        while j < len(small) and abs(small[j].cy - run[-1].cy) <= 0.4 * h and 0 <= small[j].x0 - run[-1].x1 <= 0.7 * max(run[-1].w, 1):
            run.append(small[j])
            j += 1
        if len(run) >= 4:
            combs.append(Box(min(b.x0 for b in run), min(b.y0 for b in run), max(b.x1 for b in run), max(b.y1 for b in run)))
            in_comb.update(id(b) for b in run)
        i = j
    return [b for b in boxes if id(b) not in in_comb], combs


def detect_page(tokens: list[Token], hlines: list[tuple[float, float, float]], rects: list[tuple[float, float, float, float]],
                page_w: float, page_h: float, existing: list[list[float]] | None = None) -> PageStructure:
    """``rects`` are hollow rectangles from geometry detection; ``existing`` are bboxes already covered
    by real form widgets (they win over anything detected here)."""
    out = PageStructure()
    h = median_height(tokens)
    if not tokens or h <= 0:
        return out
    existing = existing or []

    tokens, glyphs = _glyph_boxes(tokens, h)
    boxes = [Box(*r) for r in rects] + glyphs
    # geometry boxes duplicated by a glyph token are the same thing
    boxes = [b for b in boxes if b.glyph or not any(g.glyph and _iou_or_contain(b.bbox, g.bbox) > 0.5 for g in glyphs)]
    boxes = [b for b in boxes if not any(_iou_or_contain(b.bbox, e) > 0.4 for e in existing)]
    small_or_comb, combs = _comb_clusters(boxes, h)
    small = [b for b in small_or_comb if 0.5 * h <= b.w <= 2.6 * h and 0.5 * h <= b.h <= 2.6 * h and 0.7 <= b.w / max(b.h, 1e-6) <= 1.4]
    def _encloses(b: Box) -> bool:
        return sum(1 for o in small_or_comb if o is not b and o.w >= 0.5 * h and o.h >= 0.5 * h and b.x0 <= o.x0 and b.y0 <= o.y0 and b.x1 >= o.x1 and b.y1 >= o.y1) >= 2

    inputs = [b for b in small_or_comb if b not in small and b.w >= 3 * h and 0.9 * h <= b.h <= 8 * h and not _encloses(b)] + combs
    # OCR noise ("0", "O", "C]") sitting inside a tick box is not text
    tokens = [t for t in tokens if not (len(t[4]) <= 3 and any(b.x0 - 2 <= (t[0] + t[2]) / 2 <= b.x1 + 2 and b.y0 - 2 <= (t[1] + t[3]) / 2 <= b.y1 + 2 for b in small))]

    segs = build_segments(tokens, small, h)
    fields: list[dict] = []

    def add(label: str, ftype: str, page_bbox: list[float], conf: float, source: str = "layout", options: list[str] | None = None,
            description: str = "", meta: dict | None = None, required_text: str = "") -> None:
        label = clean_label(label)
        if not label or not _LETTER.search(label):
            return
        if any(_iou_or_contain(page_bbox, e) > 0.5 for e in existing):
            return
        fields.append({"label": label[:200], "type": ftype, "page_bbox": _r(page_bbox), "confidence": round(conf, 2), "source": source,
                       "options": options or [], "description": description[:300], "meta": meta or {},
                       "required": is_required(required_text or label, ftype)})

    # ---- choices and checkboxes
    opts = _extract_options(segs, small, h)
    for o in opts:
        o.seg.used = True
        o.box.used = True
    for grp, preset in _group_options(opts, segs, h):
        label_seg = _find_group_label(grp, segs, h, preset)
        if label_seg is not None:
            label_seg.used = True
        labels = [o.label for o in grp]
        bb = [min(o.box.x0 for o in grp), min(o.box.y0 for o in grp), max(o.box.x1 for o in grp), max(o.box.y1 for o in grp)]
        group_label = clean_label(label_seg.text) if label_seg else ""
        if len(grp) == 1:
            add(labels[0], "checkbox", bb, 0.8, options=[], description=group_label if group_label.lower() != labels[0].lower() else "",
                meta={"option_boxes": [o.box.bbox for o in grp]}, required_text=group_label + " " + labels[0])
        else:
            if not group_label:
                group_label = "Select one"
            add(group_label, "choice", bb, 0.85 if label_seg else 0.45, options=labels,
                meta={"option_boxes": [_r(o.box.bbox) for o in grp], "multiple": bool(MULTI_SELECT.search(group_label))},
                required_text=group_label)

    # ---- tables: a fully-labelled header row above empty cells
    rect_pool = [b for b in inputs if b not in combs]
    rows_by_y: list[list[Box]] = []
    for b in sorted(rect_pool, key=lambda b: (b.y0, b.x0)):
        for r in rows_by_y:
            if abs(r[0].y0 - b.y0) <= 0.4 * h:
                r.append(b)
                break
        else:
            rows_by_y.append([b])
    rows_by_y = [sorted(r, key=lambda b: b.x0) for r in rows_by_y if len(r) >= 2]

    def cell_text(b: Box) -> str:
        return " ".join(s.text for s in sorted((s for s in segs if not s.blank and b.x0 - 1 <= (s.x0 + s.x1) / 2 <= b.x1 + 1 and b.y0 - 1 <= s.cy <= b.y1 + 1), key=lambda s: (s.cy, s.x0)))

    i = 0
    while i < len(rows_by_y):
        head = rows_by_y[i]
        head_txt = [cell_text(b) for b in head]
        if all(head_txt):
            data_rows = []
            j = i + 1
            while j < len(rows_by_y) and len(rows_by_y[j]) == len(head) and all(abs(a.x0 - b.x0) <= 0.6 * h for a, b in zip(head, rows_by_y[j])) \
                    and rows_by_y[j][0].y0 - rows_by_y[j - 1][0].y1 <= 1.2 * h:
                data_rows.append(rows_by_y[j])
                j += 1
            empty = [(r, c) for r in data_rows for c in r if not cell_text(c)]
            if data_rows and len(empty) >= len(head):
                for s in segs:
                    if any(b.x0 - 1 <= (s.x0 + s.x1) / 2 <= b.x1 + 1 and b.y0 - 1 <= s.cy <= b.y1 + 1 for b in head):
                        s.used = True
                for n, r in enumerate(data_rows[:40], start=1):
                    for col, c in enumerate(r):
                        if cell_text(c):
                            continue
                        title = head_txt[col]
                        add(f"{clean_label(title)} (row {n})", infer_type(title), c.bbox, 0.7, source="table",
                            meta={"table": True, "row": n, "column": clean_label(title)}, required_text=title)
                        c.used = True
                i = j
                continue
        i += 1

    # ---- text fields
    segs_sorted = sorted(segs, key=lambda s: (s.cy, s.x0))
    text_segs = [s for s in segs_sorted if not s.blank and not s.used]
    blanks = [s for s in segs_sorted if s.blank]
    free_inputs = [b for b in inputs if not b.used]

    def row_neighbours(s: Seg) -> list[Seg]:
        return [t for t in segs_sorted if t is not s and abs(t.cy - s.cy) <= 0.6 * h]

    claimed_lines: set[int] = set()

    def detect_text_fields(stage: int) -> None:
        """Stage 1: evidence beside the label (blank, ruled line, box). Stage 2: below the label, or open space."""
        for s in text_segs:
            if s.used:
                continue
            label = clean_label(s.text)
            words = len(label.split())
            if not label or not _LETTER.search(label) or words > 10 or s.text.lstrip().startswith("("):
                continue
            ends_colon = s.text.rstrip().endswith((":", "：", "*")) or bool(re.search(r":\s*\*?$", s.text))
            right_edge = page_w
            for t in row_neighbours(s):
                if t.x0 >= s.x1 - 1 and not t.blank:
                    right_edge = min(right_edge, t.x0)
            ftype = infer_type(label)
            bbox = None
            conf = 0.0
            meta: dict = {}

            if stage == 1:
                # A: blank token right after the label on the same row
                for bl in blanks:
                    if bl.x0 >= s.x1 - 2 and abs(bl.cy - s.cy) <= 0.7 * h and bl.x0 - s.x1 <= 6 * h and bl.x0 < right_edge:
                        bbox = [bl.x0, min(s.y0, bl.y0), bl.x1, max(s.y1, bl.y1)]
                        conf = 0.9
                        if bl.date_blank and ftype in ("text", "name"):
                            ftype = "date"
                        break
                # B: ruled line at the label's baseline, to its right
                if bbox is None:
                    for li, (x0, x1, y) in enumerate(hlines):
                        if li in claimed_lines or not (s.y1 - 0.5 * h <= y <= s.y1 + 1.1 * h):
                            continue
                        if x1 > s.x1 + 3 * h and x0 < right_edge - 2 * h and x0 >= s.x0 - 1:
                            lx0, lx1 = max(x0, s.x1 + 0.4 * h), min(x1, right_edge - 0.4 * h)
                            if lx1 - lx0 >= 3 * h:
                                bbox = [lx0, y - 1.3 * s.h, lx1, y - 0.1 * h]
                                conf = 0.88
                                claimed_lines.add(li)
                                break
                # C: rectangle to the right on the same row
                if bbox is None:
                    for b in free_inputs:
                        if not b.used and b.x0 >= s.x1 - 0.3 * h and b.x0 - s.x1 <= 12 * h and abs(b.cy - s.cy) <= max(0.8 * b.h, h) \
                                and b.x0 < right_edge + 0.5 * h:
                            bbox = b.bbox
                            conf = 0.88
                            b.used = True
                            meta["comb"] = b in combs
                            break
            else:
                heading = s.text.isupper() and not ends_colon
                # D: lines / a tall box under the label ("Address:")
                if (ends_colon or words <= 3) and not heading:
                    under = sorted([(li, x0, x1, y) for li, (x0, x1, y) in enumerate(hlines)
                                    if li not in claimed_lines and y - s.y1 >= 0.3 * h and x0 <= s.x0 + 4 * h and x1 >= s.x0 + 4 * h],
                                   key=lambda t: t[3])
                    if under and under[0][3] - s.y1 > 2.4 * h:
                        under = []
                    if under:
                        chain = [under[0]]
                        for ln in under[1:]:
                            if 0.9 * h <= ln[3] - chain[-1][3] <= 3.0 * h and len(chain) < 5:
                                chain.append(ln)
                        claimed_lines.update(c[0] for c in chain)
                        bbox = [min(c[1] for c in chain), chain[0][3] - 1.3 * h, max(c[2] for c in chain), chain[-1][3] - 0.1 * h]
                        conf = 0.8
                        if len(chain) > 1 and ftype in ("text", "name"):
                            ftype = "multiline"
                    else:
                        for b in free_inputs:
                            if not b.used and 0 <= b.y0 - s.y1 <= 1.6 * h and _overlap_x(b.x0, b.x1, s.x0, s.x1 + 20 * h) > 0:
                                bbox = b.bbox
                                conf = 0.8
                                b.used = True
                                if b.h > 2.6 * h and ftype in ("text", "name"):
                                    ftype = "multiline"
                                break
                # E: "Label:" followed by open space (lower confidence)
                if bbox is None and ends_colon and not heading and right_edge - s.x1 >= 5 * h and words <= 6:
                    bbox = [s.x1 + 0.5 * h, s.y0, min(right_edge - 0.5 * h, s.x1 + 30 * h), s.y1 + 0.2 * h]
                    conf = 0.5
                    meta["layout_guess"] = True
            if bbox is None:
                continue
            s.used = True
            # description: small helper text right below the label, e.g. "(as per Aadhaar card)"
            desc = ""
            for t in segs_sorted:
                if not t.used and not t.blank and t.text.lstrip().startswith("(") and 0 <= t.y0 - s.y1 <= 1.2 * h and abs(t.x0 - s.x0) <= 3 * h:
                    desc = t.text.strip("() ")
                    t.used = True
                    break
            add(label, ftype, bbox, conf, description=desc, meta=meta, required_text=s.text)

    detect_text_fields(1)  # evidence beside the label first, so lines are not stolen by a label above
    detect_text_fields(2)  # then lines/boxes below a label and open space

    # ---- unlabeled-but-boxed leftovers are ignored on purpose (never invent a label)
    fields.sort(key=lambda f: (round(f["page_bbox"][1] / max(h, 1) / 1.5), f["page_bbox"][0]))
    # drop near-duplicates (same area detected twice)
    dedup: list[dict] = []
    for f in fields:
        if any(_iou_or_contain(f["page_bbox"], d["page_bbox"]) > 0.6 and f["type"] not in ("choice", "checkbox") and d["type"] not in ("choice", "checkbox") for d in dedup):
            continue
        dedup.append(f)
    out.fields = dedup
    return out
