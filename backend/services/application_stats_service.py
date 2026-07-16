INTERVIEW_STATUSES = ("interview_scheduled", "interview_completed")
HIRED_STATUSES = ("hired",)
REJECTED_STATUSES = ("rejected", "cancelled")


def bucket_application_stats(applications) -> dict:
    """Buckets a jobseeker's applications into summary counts, shared by the
    staff Jobseeker View page and the Jobseeker Excel/PDF export so both
    report the same numbers the same way."""
    total = len(applications)
    interviews = sum(1 for a in applications if a.status in INTERVIEW_STATUSES)
    hired = sum(1 for a in applications if a.status in HIRED_STATUSES)
    rejected = sum(1 for a in applications if a.status in REJECTED_STATUSES)
    active = total - hired - rejected
    return {"total": total, "interviews": interviews, "hired": hired, "rejected": rejected, "active": active}
