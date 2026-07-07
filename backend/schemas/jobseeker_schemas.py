from marshmallow import Schema, fields, validate

GENDERS = ("Male", "Female", "Prefer not to say")
CIVIL_STATUSES = ("Single", "Married", "Widowed", "Separated", "Divorced")
EMPLOYMENT_STATUSES = ("Employed", "Unemployed", "Self-Employed", "Student", "OFW/Returning OFW")
EMPLOYMENT_TYPES = ("Full-time", "Part-time", "Contractual", "Seasonal", "Freelance")
ATTAINMENT_LEVELS = ("Elementary", "High School", "Senior High School", "Vocational/TVET", "College", "Post-Graduate")


class WorkExperienceSchema(Schema):
    class Meta:
        unknown = "exclude"

    company = fields.String(load_default="")
    position = fields.String(load_default="")
    start_date = fields.Date(allow_none=True)
    end_date = fields.Date(allow_none=True)
    description = fields.String(allow_none=True)


class EducationSchema(Schema):
    class Meta:
        unknown = "exclude"

    school = fields.String(required=True, validate=validate.Length(min=1, max=255))
    degree = fields.String(allow_none=True, load_default=None)
    graduation_year = fields.Integer(allow_none=True)
    attainment_level = fields.String(allow_none=True, validate=validate.OneOf(ATTAINMENT_LEVELS))
    honors = fields.String(allow_none=True)


class ProfileUpdateSchema(Schema):
    class Meta:
        # Loaded with partial=True so callers can send only the fields they're
        # updating — mirrors the pre-existing partial-update behavior of this route.
        unknown = "exclude"

    full_name = fields.String(validate=validate.Length(min=2, max=255))
    contact_number = fields.String(allow_none=True)
    date_of_birth = fields.Date(allow_none=True)
    gender = fields.String(allow_none=True, validate=validate.OneOf(GENDERS))
    civil_status = fields.String(allow_none=True, validate=validate.OneOf(CIVIL_STATUSES))
    nationality = fields.String(allow_none=True)
    barangay = fields.String(allow_none=True)
    municipality = fields.String(allow_none=True)
    province = fields.String(allow_none=True)

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
