"""Shared server-side pagination, extracted from the Audit Trail list endpoint's
page/limit/total pattern (blueprints/admin.py::get_audit_trail) so every new
server-paginated management screen (Employer Management, Vacancy Management)
applies the same page/limit bounds and response shape instead of re-deriving it.
"""


def paginate(query, args, default_limit=50, max_limit=200):
    """query: an already-filtered SQLAlchemy query, ordered by the caller.
    args: a request.args-like mapping with optional "page"/"limit" keys.

    Returns {"items": [...ORM rows...], "total": int, "page": int, "limit": int} —
    callers still need to call .to_dict() (or similar) on each item themselves,
    since the right serialization varies per model.
    """
    page = max(int(args.get("page", 1)), 1)
    limit = min(max(int(args.get("limit", default_limit)), 1), max_limit)
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return {"items": items, "total": total, "page": page, "limit": limit}
