"""Shared query builder for the Audit Trail list + both export endpoints.

Both the on-screen list and the exports must filter identically — otherwise an
admin exports "everything" while looking at a filtered view, or vice versa. Having
exactly one function build the filtered query makes that impossible to get wrong.
"""

from datetime import datetime, timedelta

from extensions import db
from models.audit import AuditTrail


def build_audit_query(args):
    query = AuditTrail.query
    if args.get("user_role"):
        query = query.filter_by(user_role=args["user_role"])
    if args.get("user_email"):
        query = query.filter(AuditTrail.user_email.ilike(f"%{args['user_email']}%"))
    if args.get("action"):
        query = query.filter_by(action=args["action"])
    if args.get("module"):
        query = query.filter_by(module=args["module"])
    if args.get("status"):
        query = query.filter_by(status=args["status"])
    if args.get("date_from"):
        query = query.filter(AuditTrail.created_at >= datetime.fromisoformat(args["date_from"]))
    if args.get("date_to"):
        query = query.filter(AuditTrail.created_at < datetime.fromisoformat(args["date_to"]) + timedelta(days=1))
    if args.get("q"):
        like = f"%{args['q']}%"
        query = query.filter(db.or_(AuditTrail.user_email.ilike(like), AuditTrail.details.ilike(like)))
    return query
