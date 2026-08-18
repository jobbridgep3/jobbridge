"""Employer-side job fair participation reporting — backs the "My
Participations" page: registration status plus the vacancy/job position(s)
the employer tagged for each job fair."""

from models.jobfair import JobFairBooth
from models.vacancy import Vacancy


def build_participations(company):
    booths = JobFairBooth.query.filter_by(employer_company_id=company.id).order_by(JobFairBooth.created_at.desc()).all()
    result = []
    for booth in booths:
        fair = booth.jobfair
        vacancies = (
            Vacancy.query.filter_by(employer_company_id=company.id, tagged_for_jobfair_id=fair.id, status="published")
            .order_by(Vacancy.created_at.desc()).all()
        )
        result.append({
            "booth_id": str(booth.id),
            "jobfair_id": str(fair.id),
            "jobfair_name": fair.name,
            "event_date": fair.event_date.isoformat() if fair.event_date else None,
            "venue": fair.venue,
            "jobfair_status": fair.status,
            "booth_status": booth.status,
            "review_remarks": booth.review_remarks,
            "vacancies": [{"id": str(v.id), "title": v.title, "job_type": v.job_type} for v in vacancies],
        })
    return result
