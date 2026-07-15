import logging

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="Asia/Manila")


def _generate_monthly_lmi_report(app):
    with app.app_context():
        logger.info("APScheduler: generating monthly LMI aggregation snapshot.")
        # Aggregation itself is computed on-demand by /api/staff/lmi/stats; this job
        # exists as the documented monthly trigger point for future persisted snapshots.


def _auto_publish_vacancies(app):
    """approved -> published once posting_date arrives, so that field has real
    effect rather than being decorative (per the state machine's documented
    assumption). Employers/staff can still publish early via the manual action."""
    with app.app_context():
        from extensions import db
        from models.vacancy import Vacancy
        from services.notification_service import notify_user
        from utils.timezone import now_manila

        today = now_manila().date()
        due = Vacancy.query.filter(
            Vacancy.status == "approved", Vacancy.posting_date.isnot(None), Vacancy.posting_date <= today,
            Vacancy.deleted_at.is_(None),
        ).all()
        for vacancy in due:
            vacancy.status = "published"
            vacancy.published_at = now_manila()
            db.session.commit()
            notify_user(
                vacancy.employer_company.user_id, "vacancy_approved", "Vacancy Published",
                f"{vacancy.title} is now published (posting date reached).",
                link="/employer/vacancies", socket_event="vacancy:approved", socket_payload={"vacancy_id": str(vacancy.id)},
            )
        if due:
            logger.info("APScheduler: auto-published %d vacancy(ies).", len(due))


def _auto_close_vacancies(app):
    """published -> closed once application_deadline passes."""
    with app.app_context():
        from extensions import db
        from models.vacancy import Vacancy
        from services.notification_service import notify_user
        from utils.timezone import now_manila

        today = now_manila().date()
        due = Vacancy.query.filter(
            Vacancy.status == "published", Vacancy.application_deadline.isnot(None), Vacancy.application_deadline < today,
            Vacancy.deleted_at.is_(None),
        ).all()
        for vacancy in due:
            vacancy.status = "closed"
            db.session.commit()
            notify_user(
                vacancy.employer_company.user_id, "vacancy_rejected", "Vacancy Closed",
                f"{vacancy.title} was automatically closed (application deadline passed).",
                link="/employer/vacancies", socket_event="vacancy:rejected", socket_payload={"vacancy_id": str(vacancy.id)},
            )
        if due:
            logger.info("APScheduler: auto-closed %d vacancy(ies).", len(due))


def _send_interview_reminders(app):
    """Notifies both the jobseeker and the employer once per interview, for
    accepted interviews happening in the next 24 hours."""
    with app.app_context():
        from datetime import timedelta

        from extensions import db
        from models.interview import Interview
        from services.notification_service import notify_user
        from utils.timezone import now_manila

        now = now_manila()
        due = Interview.query.filter(
            Interview.status == "accepted", Interview.reminder_sent_at.is_(None),
            Interview.scheduled_date >= now, Interview.scheduled_date <= now + timedelta(hours=24),
        ).all()
        for interview in due:
            application = interview.application
            when = interview.scheduled_date.strftime("%B %d, %Y %I:%M %p")
            notify_user(
                application.jobseeker_profile.user_id, "interview_reminder", "Interview Reminder",
                f"Your interview for {application.vacancy.title} is on {when}.",
                link="/jobseeker/interviews", socket_event="interview:reminder",
                socket_payload={"interview_id": str(interview.id)},
            )
            notify_user(
                application.vacancy.employer_company.user_id, "interview_reminder", "Interview Reminder",
                f"Your interview with {application.jobseeker_profile.full_name} for {application.vacancy.title} is on {when}.",
                link="/employer/interviews", socket_event="interview:reminder",
                socket_payload={"interview_id": str(interview.id)},
            )
            interview.reminder_sent_at = now
            db.session.commit()
        if due:
            logger.info("APScheduler: sent %d interview reminder(s).", len(due))


def _advance_jobfair_statuses(app):
    """published -> ongoing on event day, ongoing -> completed once the event ends
    (end_time, or end of the event day when no end_time is set)."""
    with app.app_context():
        from datetime import timedelta

        from extensions import db
        from models.jobfair import JobFair
        from utils.timezone import now_manila

        now = now_manila()
        started = JobFair.query.filter(JobFair.status == "published", JobFair.event_date <= now).all()
        for fair in started:
            fair.status = "ongoing"
        ongoing = JobFair.query.filter(JobFair.status == "ongoing").all()
        ended = [
            fair for fair in ongoing
            if (fair.end_time and fair.end_time < now)
            or (not fair.end_time and fair.event_date and fair.event_date + timedelta(hours=12) < now)
        ]
        for fair in ended:
            fair.status = "completed"
        if started or ended:
            db.session.commit()
            logger.info("APScheduler: job fairs — %d started, %d completed.", len(started), len(ended))


def init_scheduler(app):
    if scheduler.running:
        return
    scheduler.add_job(
        lambda: _generate_monthly_lmi_report(app),
        trigger="cron", day=1, hour=0, id="monthly_lmi_report", replace_existing=True,
    )
    scheduler.add_job(
        lambda: _auto_publish_vacancies(app),
        trigger="interval", hours=1, id="auto_publish_vacancies", replace_existing=True,
    )
    scheduler.add_job(
        lambda: _auto_close_vacancies(app),
        trigger="interval", hours=1, id="auto_close_vacancies", replace_existing=True,
    )
    scheduler.add_job(
        lambda: _send_interview_reminders(app),
        trigger="interval", hours=1, id="send_interview_reminders", replace_existing=True,
    )
    scheduler.add_job(
        lambda: _advance_jobfair_statuses(app),
        trigger="interval", hours=1, id="advance_jobfair_statuses", replace_existing=True,
    )
    scheduler.start()
