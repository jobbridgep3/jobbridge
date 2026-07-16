from marshmallow import Schema, fields, pre_load, validate

from utils.validators import validate_contact_number

GENDERS = ("Male", "Female", "Prefer not to say")
CIVIL_STATUSES = ("Single", "Married", "Widowed", "Separated", "Divorced")
EMPLOYMENT_STATUSES = ("Employed", "Unemployed", "Self-Employed", "Student", "OFW/Returning OFW")
EMPLOYMENT_TYPES = ("Full-time", "Part-time", "Contractual", "Seasonal", "Freelance")
ATTAINMENT_LEVELS = ("Elementary", "High School", "Senior High School", "Vocational/TVET", "College", "Post-Graduate")


def _blanks_to_none(data: dict, *field_names: str) -> dict:
    """Coerces an empty-string value to None for the given fields, before marshmallow's
    type coercion/OneOf validation runs.

    allow_none=True only special-cases a literal None — it does not relax type
    coercion or choice validation for a *present* value of "". Blank HTML date/number
    inputs, and unselected <select> dropdowns (value=""), both submit "" rather than
    null or an omitted key. Without this, a single blank optional field (e.g. an
    unfilled graduation year, or a Select left on its placeholder option) fails
    .load() for the ENTIRE request — discarding every other valid field in that Save,
    not just the blank one.
    """
    for f in field_names:
        if data.get(f) == "":
            data[f] = None
    return data


class WorkExperienceSchema(Schema):
    class Meta:
        unknown = "exclude"

    company = fields.String(load_default="")
    position = fields.String(load_default="")
    start_date = fields.Date(allow_none=True)
    end_date = fields.Date(allow_none=True)
    description = fields.String(allow_none=True)

    @pre_load
    def _clean(self, data, **kwargs):
        return _blanks_to_none(data, "start_date", "end_date")


class EducationSchema(Schema):
    class Meta:
        unknown = "exclude"

    school = fields.String(required=True, validate=validate.Length(min=1, max=255))
    degree = fields.String(allow_none=True, load_default=None)
    graduation_year = fields.Integer(allow_none=True)
    attainment_level = fields.String(allow_none=True, validate=validate.OneOf(ATTAINMENT_LEVELS))
    honors = fields.String(allow_none=True)

    @pre_load
    def _clean(self, data, **kwargs):
        return _blanks_to_none(data, "graduation_year", "attainment_level")


class ProfileUpdateSchema(Schema):
    class Meta:
        # Loaded with partial=True so callers can send only the fields they're
        # updating — mirrors the pre-existing partial-update behavior of this route.
        unknown = "exclude"

    full_name = fields.String(validate=validate.Length(min=2, max=255))
    contact_number = fields.String(allow_none=True, validate=validate_contact_number)
    date_of_birth = fields.Date(allow_none=True)
    gender = fields.String(allow_none=True, validate=validate.OneOf(GENDERS))
    civil_status = fields.String(allow_none=True, validate=validate.OneOf(CIVIL_STATUSES))
    nationality = fields.String(allow_none=True)
    barangay = fields.String(allow_none=True)
    municipality = fields.String(allow_none=True)
    province = fields.String(allow_none=True)
    region_code = fields.String(allow_none=True)
    region_name = fields.String(allow_none=True)
    zip_code = fields.String(allow_none=True)

    employment_status = fields.String(allow_none=True, validate=validate.OneOf(EMPLOYMENT_STATUSES))
    preferred_job_position = fields.String(allow_none=True)
    preferred_industry = fields.String(allow_none=True)
    preferred_work_location = fields.String(allow_none=True)
    expected_salary = fields.String(allow_none=True)
    employment_type = fields.String(allow_none=True, validate=validate.OneOf(EMPLOYMENT_TYPES))

    technical_skills = fields.List(fields.String())
    soft_skills = fields.List(fields.String())
    languages_spoken = fields.List(fields.String())
    certifications = fields.List(fields.String())

    work_experiences = fields.List(fields.Nested(WorkExperienceSchema))
    educations = fields.List(fields.Nested(EducationSchema))

    @pre_load
    def _clean(self, data, **kwargs):
        return _blanks_to_none(data, "date_of_birth", "gender", "civil_status", "employment_status", "employment_type")
