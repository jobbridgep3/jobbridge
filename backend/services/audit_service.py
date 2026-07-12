from flask import request

from extensions import db
from models.audit import AuditTrail
from utils.client_ip import get_client_ip


def log_audit(
    user, action: str, module: str, record_id=None, details: str = None, status: str = "success",
    before=None, after=None,
):
    """Append-only audit entry. Call from every significant mutating route.

    user: a User instance, or None for unauthenticated events (e.g. failed login).
    status: "success" (default) or "failed".
    before/after: optional JSON-serializable dicts (e.g. a diff of changed fields)
    for screens that render a before/after audit view. Omit for routes that don't
    need one — every existing call site keeps working unchanged.
    """
    try:
        entry = AuditTrail(
            user_id=user.id if user else None,
            user_email=user.email if user else None,
            user_role=user.role if user else None,
            action=action,
            module=module,
            record_id=str(record_id) if record_id else None,
            ip_address=get_client_ip() if request else None,
            user_agent=request.headers.get("User-Agent", "")[:500] if request else None,
            details=details,
            status=status,
            before_state=before,
            after_state=after,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        db.session.rollback()
