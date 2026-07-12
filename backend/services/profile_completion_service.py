"""Canonical definition of what makes a Job Seeker Profile "complete."

Replaces the old weighted 5-category formula (which counted expected_salary despite
it being UI-labeled optional, and never counted several editable fields at all) with
a flat, unweighted list of named required checks — so `profile_completion` is a
literal "N of M complete" percentage, and each item can be surfaced individually as
a missing-field checklist item in the frontend.

frontend/src/pages/jobseeker/profile-sections/requiredFields.js hand-mirrors this
exact list (same convention already used for enum lists in options.js) for live,
pre-save recalculation with no network round-trip — keep both in sync.
"""

# Each entry: (key, section, label, check_fn(profile) -> bool). `key` must exactly
# match the frontend form/field key so click-to-scroll and red-border targeting work.
REQUIRED_FIELDS = [
    ("full_name", "personal", "Full Name", lambda p: bool(p.full_name)),
    ("contact_number", "personal", "Contact Number", lambda p: bool(p.contact_number)),
    ("date_of_birth", "personal", "Date of Birth", lambda p: bool(p.date_of_birth)),
    ("gender", "personal", "Gender", lambda p: bool(p.gender)),
    ("civil_status", "personal", "Civil Status", lambda p: bool(p.civil_status)),
    ("nationality", "personal", "Nationality", lambda p: bool(p.nationality)),
    ("barangay", "personal", "Barangay", lambda p: bool(p.barangay)),
    ("municipality", "personal", "Municipality", lambda p: bool(p.municipality)),
    ("province", "personal", "Province", lambda p: bool(p.province)),
    ("resume_url", "documents", "Resume/CV Uploaded", lambda p: bool(p.resume_url)),
    (
        "government_id", "documents", "Valid Government ID",
        lambda p: "government_id" in {d.document_type for d in p.documents},
    ),
    ("employment_status", "employment", "Employment Status", lambda p: bool(p.employment_status)),
    ("preferred_job_position", "employment", "Preferred Job Position", lambda p: bool(p.preferred_job_position)),
    ("preferred_industry", "employment", "Preferred Industry", lambda p: bool(p.preferred_industry)),
    ("preferred_work_location", "employment", "Preferred Work Location", lambda p: bool(p.preferred_work_location)),
    ("employment_type", "employment", "Employment Type Preferred", lambda p: bool(p.employment_type)),
    (
        "educations", "education", "At Least One Education Entry",
        lambda p: any(e.school and e.attainment_level for e in p.educations),
    ),
    ("technical_skills", "skills", "Technical Skills", lambda p: bool(p.technical_skills)),
    ("soft_skills", "skills", "Soft Skills", lambda p: bool(p.soft_skills)),
    # Intentionally excluded (optional, matches existing UI labeling):
    # expected_salary, work_experiences, languages_spoken, certifications.
]


def compute_completion(profile, required_fields=None) -> dict:
    """Returns {"profile_completion": int, "completed_count": int, "total_count": int,
    "missing_fields": [{"key","section","label"}, ...]}.

    required_fields defaults to the jobseeker REQUIRED_FIELDS list above so every
    existing call site is unaffected; pass COMPANY_REQUIRED_FIELDS / HR_REQUIRED_FIELDS
    (below) to reuse this same engine for Company Profile / HR Profile completion.
    """
    fields = required_fields if required_fields is not None else REQUIRED_FIELDS
    results = [(key, section, label, bool(check(profile))) for key, section, label, check in fields]
    total = len(results)
    completed = sum(1 for *_, ok in results if ok)
    missing_fields = [{"key": key, "section": section, "label": label} for key, section, label, ok in results if not ok]

    return {
        "profile_completion": round(completed / total * 100) if total else 100,
        "completed_count": completed,
        "total_count": total,
        "missing_fields": missing_fields,
    }
