"""Shared query builder for Admin/Staff Vacancy Management — the on-screen list
and all three export scopes (current_page|selected|all) build from this exact
same filtered query, so an export can never show different rows than what's
on screen. Mirrors services/audit_query_service.py's "one function" discipline.
"""

from datetime import datetime, timedelta

from extensions import db
from models.employer import EmployerCompany
from models.vacancy import Vacancy


def build_vacancy_query(args):
    query = db.session.query(Vacancy).join(EmployerCompany, Vacancy.employer_company_id == EmployerCompany.id).filter(
        Vacancy.deleted_at.is_(None)
    )
    if args.get("status"):
        query = query.filter(Vacancy.status == args["status"])
    if args.get("category_id"):
        query = query.filter(Vacancy.category_id == args["category_id"])
    if args.get("industry"):
        query = query.filter(Vacancy.industry.ilike(f"%{args['industry']}%"))
    if args.get("municipality"):
        query = query.filter(Vacancy.city_municipality_name.ilike(f"%{args['municipality']}%"))
    if args.get("job_type"):
        query = query.filter(Vacancy.job_type == args["job_type"])
    if args.get("employer_company_id"):
        query = query.filter(Vacancy.employer_company_id == args["employer_company_id"])
    if args.get("date_from"):
        query = query.filter(Vacancy.created_at >= datetime.fromisoformat(args["date_from"]))
    if args.get("date_to"):
        query = query.filter(Vacancy.created_at < datetime.fromisoformat(args["date_to"]) + timedelta(days=1))
    if args.get("q"):
        like = f"%{args['q']}%"
        query = query.filter(db.or_(Vacancy.title.ilike(like), EmployerCompany.company_name.ilike(like)))
    return query
