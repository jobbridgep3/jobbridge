import uuid

from supabase import Client, create_client

from flask import current_app

_client: Client | None = None


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
