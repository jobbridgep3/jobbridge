"""Free-text list extraction (certifications, languages) — the section header match
itself is the confidence signal; every non-empty line/comma-separated item within an
isolated section is kept as-is, since these map to free-text JSON list columns.
"""


def extract_list_section(sections: dict, key: str) -> list[str]:
    chunk = sections.get(key) or ""
    items = []
    for line in chunk.splitlines():
        cleaned = line.strip(" -•*\t")
        if not cleaned:
            continue
        items.extend(part.strip() for part in cleaned.split(",") if part.strip())
    return sorted(set(items))
