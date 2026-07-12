from datetime import date

from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from models.employer import BUSINESS_TYPES, COMPANY_SIZES, EMPLOYMENT_TYPES_OFFERED, HIRING_STATUSES, WORK_SETUPS
from services import psgc_service
from utils.validators import validate_contact_number

URL_RE = validate.Regexp(r"^https?://", error="Must be a valid URL starting with http:// or https://")


def _blanks_to_none(data: dict, *field_names: str) -> dict:
    for f in field_names:
        if data.get(f) == "":
            data[f] = None
    return data


class CompanyProfileSchema(Schema):
    """Loaded with partial=True (PUT /api/company) so callers can save one section
    at a time without needing every field present, matching the jobseeker
    ProfileUpdateSchema convention."""

    class Meta:
        unknown = "exclude"

    # Basic Information
    company_name = fields.String(allow_none=True, validate=validate.Length(max=255))
    trade_name = fields.String(allow_none=True, validate=validate.Length(max=255))
    business_type = fields.String(allow_none=True, validate=validate.OneOf(BUSINESS_TYPES))
    industry = fields.String(allow_none=True, validate=validate.Length(max=150))
    nature_of_business = fields.String(allow_none=True, validate=validate.Length(max=255))
    description = fields.String(allow_none=True)
    year_established = fields.Integer(allow_none=True, validate=validate.Range(min=1900, max=date.today().year))
    num_employees = fields.Integer(allow_none=True, validate=validate.Range(min=0))
    company_size = fields.String(allow_none=True, validate=validate.OneOf(COMPANY_SIZES))
    website = fields.String(allow_none=True, validate=URL_RE)
    company_email = fields.Email(allow_none=True)
    contact_number = fields.String(allow_none=True, validate=validate_contact_number)
    alt_contact_number = fields.String(allow_none=True, validate=validate_contact_number)

    # Business Registration
    business_permit_no = fields.String(allow_none=True, validate=validate.Length(max=150))
    bir_tin = fields.String(allow_none=True, validate=validate.Length(max=30))
    sec_number = fields.String(allow_none=True, validate=validate.Length(max=50))
    dti_number = fields.String(allow_none=True, validate=validate.Length(max=50))
    cda_number = fields.String(allow_none=True, validate=validate.Length(max=50))
    philgeps_registration_no = fields.String(allow_none=True, validate=validate.Length(max=50))

    # Address
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

    # Company Representative
    rep_name = fields.String(allow_none=True, validate=validate.Length(max=255))
    rep_position = fields.String(allow_none=True, validate=validate.Length(max=150))
    rep_email = fields.Email(allow_none=True)
    rep_contact_number = fields.String(allow_none=True, validate=validate_contact_number)
    rep_gov_id_number = fields.String(allow_none=True, validate=validate.Length(max=100))

    # Employment Information
    hiring_status = fields.String(allow_none=True, validate=validate.OneOf(HIRING_STATUSES))
    preferred_hiring_areas = fields.List(fields.String())
    work_setup = fields.List(fields.String(validate=validate.OneOf(WORK_SETUPS)))
    employment_types_offered = fields.List(fields.String(validate=validate.OneOf(EMPLOYMENT_TYPES_OFFERED)))

    # Social Media (optional)
    facebook_url = fields.String(allow_none=True, validate=URL_RE)
    linkedin_url = fields.String(allow_none=True, validate=URL_RE)
    instagram_url = fields.String(allow_none=True, validate=URL_RE)
    x_url = fields.String(allow_none=True, validate=URL_RE)

    @pre_load
    def _clean(self, data, **kwargs):
        return _blanks_to_none(
            data, "year_established", "num_employees", "company_size", "business_type", "hiring_status",
            "website", "facebook_url", "linkedin_url", "instagram_url", "x_url",
        )

    @validates_schema
    def _validate_address_codes(self, data, **kwargs):
        if not psgc_service.validate_address(
            region_code=data.get("region_code"), province_code=data.get("province_code"),
            city_municipality_code=data.get("city_municipality_code"), barangay_code=data.get("barangay_code"),
        ):
            raise ValidationError("One or more address codes are not recognized PSGC codes.", field_name="region_code")
