"""OpenCV helpers: photo clean-up (orientation, perspective correction) and page geometry (ruled lines, boxes)."""
from __future__ import annotations

import io

import cv2
import numpy as np
from PIL import Image, ImageOps

MAX_SIDE = 2600
MIN_SIDE = 1500


def load_oriented(data: bytes) -> np.ndarray:
    """Decode with EXIF orientation applied (phone photos are often stored rotated). Returns BGR."""
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", im.size, "white")
            im = im.convert("RGBA")
            bg.paste(im, mask=im.split()[-1])
            im = bg
        rgb = np.asarray(im.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def _resize(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest > MAX_SIDE:
        s = MAX_SIDE / longest
    elif longest < MIN_SIDE:
        s = MIN_SIDE / longest  # small photos OCR badly; upscale
    else:
        return img
    return cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)


def _order_quad(pts: np.ndarray) -> np.ndarray:
    pts = pts.reshape(4, 2).astype("float32")
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], dtype="float32")


def find_document_quad(img: np.ndarray) -> np.ndarray | None:
    """Largest four-cornered outline covering a good part of the frame (the sheet of paper), else None."""
    h, w = img.shape[:2]
    scale = 800 / max(h, w)
    small = cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    frame_area = small.shape[0] * small.shape[1]
    best, best_area = None, 0.0
    # Two attempts: edges, then bright-paper mask (edges fail when the paper edge is faint).
    masks = [cv2.dilate(cv2.Canny(gray, 50, 150), np.ones((3, 3), np.uint8), iterations=2),
             cv2.morphologyEx(cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1], cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))]
    for m in masks:
        cnts, _ = cv2.findContours(m, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for c in sorted(cnts, key=cv2.contourArea, reverse=True)[:6]:
            area = cv2.contourArea(c)
            if area < 0.25 * frame_area or area > 0.985 * frame_area:
                continue
            approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
            if len(approx) == 4 and cv2.isContourConvex(approx) and area > best_area:
                best, best_area = approx, area
        if best is not None:
            break
    return None if best is None else _order_quad(best / scale)


def warp(img: np.ndarray, quad: np.ndarray) -> np.ndarray:
    tl, tr, br, bl = quad
    w = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    h = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    if w < 300 or h < 300:
        return img
    dst = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype="float32")
    return cv2.warpPerspective(img, cv2.getPerspectiveTransform(quad, dst), (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def _tilt_angle(gray: np.ndarray) -> float:
    """Small rotation of the text baseline (degrees) from long near-horizontal line segments."""
    edges = cv2.Canny(gray, 60, 160)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 720, threshold=120, minLineLength=gray.shape[1] // 4, maxLineGap=12)
    if lines is None:
        return 0.0
    angs = [np.degrees(np.arctan2(y2 - y1, x2 - x1)) for x1, y1, x2, y2 in lines[:, 0]]
    angs = [a for a in angs if abs(a) < 8]
    return float(np.median(angs)) if len(angs) >= 3 else 0.0


def prepare_photo(data: bytes) -> tuple[np.ndarray, dict]:
    """Photo/scan -> upright, resized, perspective-corrected colour page. The original bytes are never touched."""
    img = _resize(load_oriented(data))
    info = {"perspective_corrected": False, "deskew_degrees": 0.0}
    quad = find_document_quad(img)
    if quad is not None:
        warped = warp(img, quad)
        info["perspective_corrected"] = warped is not img
        img = warped
    angle = _tilt_angle(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    if 0.3 <= abs(angle) <= 8:
        h, w = img.shape[:2]
        m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
        img = cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        info["deskew_degrees"] = round(angle, 2)
    return img, info


def enhance_for_ocr(img: np.ndarray, photo: bool) -> np.ndarray:
    """Grayscale, noise reduction and (for photos) shadow-tolerant thresholding. Feeds OCR only."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    if not photo:
        return gray
    gray = cv2.medianBlur(gray, 3)
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 41, 15)


def to_png(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise RuntimeError("PNG encoding failed")
    return buf.tobytes()


# --------------------------------------------------------------------------- geometry
def detect_geometry(gray: np.ndarray) -> dict:
    """Ruled lines and rectangles in pixel coordinates.
    Returns {"hlines": [(x0, x1, y)], "boxes": [(x0, y0, x1, y1)]} (boxes: hollow rectangles of any size)."""
    h, w = gray.shape[:2]
    binv = cv2.adaptiveThreshold(cv2.GaussianBlur(gray, (3, 3), 0), 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 12)

    def lines(kernel, horizontal: bool):
        m = cv2.morphologyEx(binv, cv2.MORPH_OPEN, kernel)
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        out = []
        for c in cnts:
            x, y, bw, bh = cv2.boundingRect(c)
            if horizontal and bh <= max(6, h // 150):
                out.append((x, x + bw, y + bh / 2))
            elif not horizontal and bw <= max(6, w // 150):
                out.append((y, y + bh, x + bw / 2))
        return out

    min_len = max(30, w // 30)
    hl = lines(cv2.getStructuringElement(cv2.MORPH_RECT, (min_len, 1)), True)
    hl.sort(key=lambda t: (t[2], t[0]))
    merged: list[list[float]] = []
    for x0, x1, y in hl:  # merge fragments of one ruled line
        for m in merged:
            if abs(m[2] - y) <= 3 and x0 <= m[1] + 6 and x1 >= m[0] - 6:
                m[0], m[1] = min(m[0], x0), max(m[1], x1)
                break
        else:
            merged.append([x0, x1, y])

    boxes = []
    cnts, _ = cv2.findContours(binv, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for c in cnts:
        x, y, bw, bh = cv2.boundingRect(c)
        if bw < 7 or bh < 7 or bw > w * 0.95 or bh > h * 0.6:
            continue
        if cv2.contourArea(c) < 0.6 * bw * bh and bw < 60:
            continue
        approx = cv2.approxPolyDP(c, max(2.0, 0.12 * min(bw, bh)), True)  # tolerance relative to the short side: wide cells are thin
        if len(approx) != 4 or cv2.contourArea(c) < 0.85 * bw * bh:
            continue
        if min(bw, bh) < 30:  # small: must be hollow (a tick box), not a letter or a filled shape; big cells may hold text
            pad = max(2, int(min(bw, bh) * 0.28))
            inner = binv[y + pad:y + bh - pad, x + pad:x + bw - pad]
            if inner.size == 0 or inner.mean() > 0.12 * 255:
                continue
        boxes.append((x, y, x + bw, y + bh))
    # a hollow rectangle yields an outer and an inner contour: keep one
    boxes.sort(key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
    kept: list[tuple] = []
    for b in boxes:
        if any(abs(b[0] - k[0]) <= 4 and abs(b[1] - k[1]) <= 4 and abs(b[2] - k[2]) <= 4 and abs(b[3] - k[3]) <= 4 for k in kept):
            continue
        kept.append(b)
    return {"hlines": [tuple(m) for m in merged], "boxes": kept}
