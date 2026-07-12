import bleach

# Rich-text vacancy description fields (summary/responsibilities/daily_tasks) are
# authored by employers via the Tiptap editor and later rendered as raw HTML on
# public jobseeker-facing pages — sanitize server-side before persisting so a
# malicious employer account can't stored-XSS every visitor to a job listing.
ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h3", "h4", "blockquote", "a"]
ALLOWED_ATTRIBUTES = {"a": ["href", "rel", "target"]}


def sanitize_html(value: str | None) -> str | None:
    if not value:
        return value
    return bleach.clean(value, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True)
