from marshmallow import Schema, fields, validate


class ContactSchema(Schema):
    class Meta:
        unknown = "exclude"

    name = fields.Str(required=True, validate=validate.Length(min=2, max=120))
    email = fields.Email(required=True)
    subject = fields.Str(load_default="General Inquiry", validate=validate.Length(max=150))
    message = fields.Str(required=True, validate=validate.Length(min=10, max=3000))
    # Honeypot — a hidden field real visitors never fill in; only bots that blindly
    # populate every input on the form will trip it.
    website = fields.Str(load_default="")
