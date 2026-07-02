"""One-off script to create the Supabase Storage bucket used for all file uploads
(resumes, company documents/logos, program documents, referral letters, certificates).
Run manually: `python setup_storage.py`
"""

import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def main():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "jobbridge-files")

    client = create_client(url, key)
    existing = [b.name for b in client.storage.list_buckets()]
    if bucket in existing:
        print(f"Bucket '{bucket}' already exists.")
        return

    client.storage.create_bucket(bucket, options={"public": True})
    print(f"Bucket '{bucket}' created (public).")


if __name__ == "__main__":
    main()
