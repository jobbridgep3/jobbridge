import uuid

from supabase import Client, create_client

from flask import current_app

_client: Client | None = None

ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}
MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024  # 5MB


def validate_upload_file(file_bytes: bytes, filename: str) -> str | None:
    """Returns an error message if the file is invalid, else None."""
    if not file_bytes:
        return "The uploaded file is empty."
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        return "Only PDF, JPG, and PNG files are allowed."
    if len(file_bytes) > MAX_DOCUMENT_SIZE_BYTES:
        return "File is too large. Maximum size is 5MB."
    return None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(current_app.config["SUPABASE_URL"], current_app.config["SUPABASE_SERVICE_ROLE_KEY"])
    return _client


def upload_file(file_bytes: bytes, original_filename: str, folder: str, content_type: str = "application/octet-stream") -> str:
    """Uploads to the Supabase Storage bucket and returns a public URL."""
    bucket = current_app.config["SUPABASE_STORAGE_BUCKET"]
    ext = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "bin"
    path = f"{folder}/{uuid.uuid4().hex}.{ext}"
    client = get_client()
    client.storage.from_(bucket).upload(path, file_bytes, {"content-type": content_type, "upsert": "true"})
    return client.storage.from_(bucket).get_public_url(path)


def delete_file(path: str):
    bucket = current_app.config["SUPABASE_STORAGE_BUCKET"]
    get_client().storage.from_(bucket).remove([path])
