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


def _company_doc_types(company):
    return {d.document_type for d in company.documents}


def _company_registration_number_ok(company) -> bool:
    field = company.registration_number_field()
    return bool(getattr(company, field, None)) if field else False


# Mirrors frontend/src/pages/employer/company-sections/requiredFields.js — keep in sync.
COMPANY_REQUIRED_FIELDS = [
    ("company_name", "basic", "Company Name", lambda c: bool(c.company_name)),
    ("business_type", "basic", "Business Type", lambda c: bool(c.business_type)),
    ("industry", "basic", "Industry", lambda c: bool(c.industry)),
    ("description", "basic", "About Company", lambda c: bool(c.description)),
    ("company_email", "basic", "Company Email", lambda c: bool(c.company_email)),
    ("contact_number", "basic", "Contact Number", lambda c: bool(c.contact_number)),
    ("year_established", "basic", "Year Established", lambda c: bool(c.year_established)),
    ("num_employees", "basic", "Number of Employees", lambda c: bool(c.num_employees)),
    ("company_size", "basic", "Company Size", lambda c: bool(c.company_size)),
    ("region_code", "address", "Region", lambda c: bool(c.region_code)),
    ("province_code", "address", "Province", lambda c: bool(c.province_code)),
    ("city_municipality_code", "address", "City / Municipality", lambda c: bool(c.city_municipality_code)),
    ("barangay_code", "address", "Barangay", lambda c: bool(c.barangay_code)),
    ("street_address", "address", "Street Address", lambda c: bool(c.street_address)),
    ("business_permit_no", "business_registration", "Business Permit Number", lambda c: bool(c.business_permit_no)),
    ("bir_tin", "business_registration", "BIR TIN", lambda c: bool(c.bir_tin)),
    ("registration_number", "business_registration", "SEC/DTI/CDA Number", _company_registration_number_ok),
    ("rep_name", "representative", "Representative Name", lambda c: bool(c.rep_name)),
    ("rep_position", "representative", "Representative Position", lambda c: bool(c.rep_position)),
    ("rep_email", "representative", "Representative Email", lambda c: bool(c.rep_email)),
    ("rep_contact_number", "representative", "Representative Contact Number", lambda c: bool(c.rep_contact_number)),
    ("hiring_status", "employment", "Hiring Status", lambda c: bool(c.hiring_status)),
    ("work_setup", "employment", "Work Setup", lambda c: bool(c.work_setup)),
    ("employment_types_offered", "employment", "Employment Types Offered", lambda c: bool(c.employment_types_offered)),
    ("business_permit", "documents", "Business Permit", lambda c: "business_permit" in _company_doc_types(c)),
    (
        "business_registration_certificate", "documents", "SEC/DTI/CDA Certificate",
        lambda c: "business_registration_certificate" in _company_doc_types(c),
    ),
    ("bir_registration", "documents", "BIR Registration", lambda c: "bir_registration" in _company_doc_types(c)),
    ("company_logo", "documents", "Company Logo", lambda c: "company_logo" in _company_doc_types(c)),
]


def _hr_doc_types(profile):
    return {d.document_type for d in profile.documents}


# Mirrors frontend/src/pages/employer/hr-sections/requiredFields.js — keep in sync.
HR_REQUIRED_FIELDS = [
    ("full_name", "personal", "Full Name", lambda p: bool(p.full_name)),
    ("gender", "personal", "Gender", lambda p: bool(p.gender)),
    ("date_of_birth", "personal", "Birthday", lambda p: bool(p.date_of_birth)),
    ("civil_status", "personal", "Civil Status", lambda p: bool(p.civil_status)),
    ("nationality", "personal", "Nationality", lambda p: bool(p.nationality)),
    ("personal_email", "contact", "Personal Email", lambda p: bool(p.personal_email)),
    ("mobile_number", "contact", "Mobile Number", lambda p: bool(p.mobile_number)),
    ("employee_id", "employment", "Employee ID", lambda p: bool(p.employee_id)),
    ("department", "employment", "Department", lambda p: bool(p.department)),
    ("position", "employment", "Position", lambda p: bool(p.position)),
    ("employment_status", "employment", "Employment Status", lambda p: bool(p.employment_status)),
    ("hr_role", "employment", "HR Role", lambda p: bool(p.hr_role)),
    ("region_code", "address", "Region", lambda p: bool(p.region_code)),
    ("province_code", "address", "Province", lambda p: bool(p.province_code)),
    ("city_municipality_code", "address", "City / Municipality", lambda p: bool(p.city_municipality_code)),
    ("barangay_code", "address", "Barangay", lambda p: bool(p.barangay_code)),
    ("street_address", "address", "Street Address", lambda p: bool(p.street_address)),
    ("government_id", "documents", "Government ID", lambda p: "government_id" in _hr_doc_types(p)),
    ("company_id", "documents", "Company ID", lambda p: "company_id" in _hr_doc_types(p)),
    ("authorization_letter", "documents", "Authorization Letter", lambda p: "authorization_letter" in _hr_doc_types(p)),
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
