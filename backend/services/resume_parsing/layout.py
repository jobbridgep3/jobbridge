"""Reconstructs correct reading order from Vision's per-block bounding-box geometry.

Vision's flat `full_text_annotation.text` linearizes blocks in whatever order its own
internal layout analysis produces, which is often approximately geometric but not
reliably so — this is the main reason two-column resumes (a sidebar of contact/skills
next to a main content column) come out with sidebar and main-column lines interleaved
line-by-line, scrambling both. Reordering explicitly by block geometry fixes this.
"""

GUTTER_MIN_WIDTH_FRACTION = 0.04  # a real column gutter, not just paragraph spacing
GUTTER_SEARCH_LO_FRACTION = 0.30
GUTTER_SEARCH_HI_FRACTION = 0.70


def _detect_gutter(blocks: list[dict], width: int) -> tuple[float, float] | None:
    """Finds a vertical band in the 30-70% width range that no block straddles, wide
    enough to be a structural column gutter rather than incidental whitespace. Returns
    (start, end) of the widest such band, or None if no page-wide gutter exists."""
    lo, hi = width * GUTTER_SEARCH_LO_FRACTION, width * GUTTER_SEARCH_HI_FRACTION
    if lo >= hi:
        return None

    step = max(1, width / 200)
    best = None
    band_start = None
    x = lo
    while x <= hi:
        straddled = any(b["x0"] < x < b["x1"] for b in blocks)
        if not straddled:
            if band_start is None:
                band_start = x
            band_end = x
        else:
            if band_start is not None and band_end - band_start >= width * GUTTER_MIN_WIDTH_FRACTION:
                if best is None or (band_end - band_start) > (best[1] - best[0]):
                    best = (band_start, band_end)
            band_start = None
        x += step
    if band_start is not None and band_end - band_start >= width * GUTTER_MIN_WIDTH_FRACTION:
        if best is None or (band_end - band_start) > (best[1] - best[0]):
            best = (band_start, band_end)
    return best


def _reorder_page(blocks: list[dict], width: int) -> list[dict]:
    if not width:
        width = max((b["x1"] for b in blocks), default=1)

    gutter = _detect_gutter(blocks, width)
    if gutter:
        mid = (gutter[0] + gutter[1]) / 2
        left = [b for b in blocks if b["x1"] <= mid]
        right = [b for b in blocks if b["x0"] >= mid]
        if len(left) >= 2 and len(right) >= 2:
            left.sort(key=lambda b: b["y0"])
            right.sort(key=lambda b: b["y0"])
            return left + right

    return sorted(blocks, key=lambda b: (b["y0"], b["x0"]))


def reorder_blocks(layout: dict | None) -> str:
    """Returns a reading-order-corrected text string built from Vision's block
    geometry. Falls back to the flattened `full_text` if no usable block layout is
    present (e.g. the OCR call didn't produce one for some reason)."""
    if not layout:
        return ""

    parts = []
    for page in layout.get("pages", []):
        blocks = [b for b in page.get("blocks", []) if (b.get("text") or "").strip()]
        if not blocks:
            continue
        ordered = _reorder_page(blocks, page.get("width") or 0)
        parts.append("\n\n".join(b["text"] for b in ordered))

    if parts:
        return "\n\n".join(parts)
    return layout.get("full_text") or ""
