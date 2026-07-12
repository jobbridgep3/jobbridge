"""Shared query builder for the Employer Management list + Excel export — same
"exactly one function builds the filtered query" discipline as
services/audit_query_service.py, so the on-screen table and the export can never
drift out of sync with each other.
"""

from datetime import datetime, timedelta

from extensions import db
from models.employer import EmployerCompany
from models.user import User


def build_employer_query(args):
    query = db.session.query(EmployerCompany).join(User, EmployerCompany.user_id == User.id)
    if args.get("accreditation_status"):
        query = query.filter(EmployerCompany.accreditation_status == args["accreditation_status"])
    if args.get("industry"):
        query = query.filter(EmployerCompany.industry.ilike(f"%{args['industry']}%"))
    if args.get("business_type"):
        query = query.filter(EmployerCompany.business_type == args["business_type"])
    if args.get("region_code"):
        query = query.filter(EmployerCompany.region_code == args["region_code"])
    if args.get("is_active") == "true":
        query = query.filter(User.is_active.is_(True))
    elif args.get("is_active") == "false":
        query = query.filter(User.is_active.is_(False))
    if args.get("date_from"):
        query = query.filter(EmployerCompany.created_at >= datetime.fromisoformat(args["date_from"]))
    if args.get("date_to"):
        query = query.filter(EmployerCompany.created_at < datetime.fromisoformat(args["date_to"]) + timedelta(days=1))
    if args.get("q"):
        like = f"%{args['q']}%"
        query = query.filter(db.or_(EmployerCompany.company_name.ilike(like), User.email.ilike(like)))
    return query
