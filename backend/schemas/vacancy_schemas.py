from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from models.vacancy import CIVIL_STATUSES, GENDERS, SCREENING_QUESTION_TYPES, WORK_ARRANGEMENTS
from utils.timezone import now_manila
from utils.validators import validate_contact_number


def _blanks_to_none(data: dict, *field_names: str) -> dict:
    for f in field_names:
        if data.get(f) == "":
            data[f] = None
    return data


class ScreeningQuestionSchema(Schema):
    class Meta:
        unknown = "exclude"

    question_text = fields.String(required=True, validate=validate.Length(min=1, max=500))
    question_type = fields.String(load_default="text", validate=validate.OneOf(SCREENING_QUESTION_TYPES))
    options = fields.List(fields.String(), allow_none=True)
    is_required = fields.Boolean(load_default=True)
    display_order = fields.Integer(load_default=0)


class VacancyWriteSchema(Schema):
    """Loaded with partial=True for both create (Save Draft) and update — only
    "title" is enforced as non-blank, and only at the point of Submit for
    Approval (not at Save Draft), so employers can save partial progress."""

    class Meta:
        unknown = "exclude"

    # Basic
    title = fields.String(allow_none=True, validate=validate.Length(max=255))
    category_id = fields.String(allow_none=True)
    industry = fields.String(allow_none=True, validate=validate.Length(max=150))
    department = fields.String(allow_none=True, validate=validate.Length(max=150))
    vacancy_no = fields.String(allow_none=True, validate=validate.Length(max=50))
    num_slots = fields.Integer(allow_none=True, validate=validate.Range(min=1))
    job_type = fields.String(allow_none=True, validate=validate.Length(max=30))
    work_arrangement = fields.String(allow_none=True, validate=validate.OneOf(WORK_ARRANGEMENTS))
    schedule = fields.String(allow_none=True, validate=validate.Length(max=255))

    # Description (rich text — sanitized post-load by the caller, not here)
    summary = fields.String(allow_none=True)
    responsibilities = fields.String(allow_none=True)
    daily_tasks = fields.String(allow_none=True)

    # Qualifications
    education_level = fields.String(allow_none=True, validate=validate.Length(max=50))
    course = fields.String(allow_none=True, validate=validate.Length(max=150))
    min_experience_years = fields.Integer(allow_none=True, validate=validate.Range(min=0, max=60))
    fresh_grad_ok = fields.Boolean(allow_none=True)
    required_skills = fields.List(fields.String())
    required_certifications = fields.List(fields.String())

    # Salary
    salary_min = fields.Decimal(allow_none=True, as_string=False)
    salary_max = fields.Decimal(allow_none=True, as_string=False)
    hide_salary = fields.Boolean(allow_none=True)
    benefits = fields.List(fields.String())

    # Location
    work_location = fields.String(allow_none=True, validate=validate.Length(max=255))
    region_code = fields.String(allow_none=True)
    region_name = fields.String(allow_none=True)
    province_code = fields.String(allow_none=True)
    province_name = fields.String(allow_none=True)
    city_municipality_code = fields.String(allow_none=True)
    city_municipality_name = fields.String(allow_none=True)
    barangay_code = fields.String(allow_none=True)
    barangay_name = fields.String(allow_none=True)
    street_address = fields.String(allow_none=True, validate=validate.Length(max=255))
    zip_code = fields.String(allow_none=True, validate=validate.Length(max=10))

    # Hiring Details
    posting_date = fields.Date(allow_none=True)
    application_deadline = fields.Date(allow_none=True)
    expected_start_date = fields.Date(allow_none=True)

    # Applicant Preferences
    pref_age_min = fields.Integer(allow_none=True, validate=validate.Range(min=15, max=100))
    pref_age_max = fields.Integer(allow_none=True, validate=validate.Range(min=15, max=100))
    pref_gender = fields.String(allow_none=True, validate=validate.OneOf(GENDERS))
    pref_civil_status = fields.String(allow_none=True, validate=validate.OneOf(CIVIL_STATUSES))
    pref_languages = fields.List(fields.String())
    fresh_grad_friendly = fields.Boolean(allow_none=True)
    pwd_friendly = fields.Boolean(allow_none=True)
    senior_citizen_friendly = fields.Boolean(allow_none=True)
    ofw_friendly = fields.Boolean(allow_none=True)

    # Required Documents (applicant-facing)
    required_applicant_documents = fields.List(fields.String())

    # Contact Person
    contact_name = fields.String(allow_none=True, validate=validate.Length(max=255))
    contact_email = fields.Email(allow_none=True)
    contact_number = fields.String(allow_none=True, validate=validate_contact_number)

    # Additional Info
    culture_description = fields.String(allow_none=True)
    career_growth_description = fields.String(allow_none=True)
    additional_notes = fields.String(allow_none=True)

    # Screening Questions (replace-all-on-write, same convention as jobseeker's
    # work_experiences/educations lists)
    screening_questions = fields.List(fields.Nested(ScreeningQuestionSchema))

    # Legacy fallback fields (still accepted directly for compatibility)
    description = fields.String(allow_none=True)
    requirements = fields.String(allow_none=True)

    @pre_load
    def _clean(self, data, **kwargs):
        return _blanks_to_none(
            data, "category_id", "posting_date", "application_deadline", "expected_start_date",
            "work_arrangement", "pref_gender", "pref_civil_status", "salary_min", "salary_max",
        )

    @validates_schema
    def _validate_date_order(self, data, **kwargs):
        """Partial=True on both create/update, so drafts may only have one date
        filled in at a time — only compare a pair once both sides are present."""
        posting_date = data.get("posting_date")
        deadline = data.get("application_deadline")
        start_date = data.get("expected_start_date")

        if posting_date and deadline and deadline < posting_date:
            raise ValidationError("Application deadline cannot be earlier than the posting date.", field_name="application_deadline")
        if deadline and start_date and start_date < deadline:
            raise ValidationError("Expected start date cannot be earlier than the application deadline.", field_name="expected_start_date")
        if deadline and deadline < now_manila().date():
            raise ValidationError("Application deadline cannot be in the past.", field_name="application_deadline")
