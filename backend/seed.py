"""One-off script to seed the Admin account. Run manually: `python seed.py`
Reads ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD from the environment only — never hardcode.
"""

import os
import sys

from app import create_app
from extensions import db
from models.user import User


def main():
    email = os.environ.get("ADMIN_SEED_EMAIL")
    password = os.environ.get("ADMIN_SEED_PASSWORD")
    if not email or not password:
        print("ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in the environment.")
        sys.exit(1)

    app = create_app()
    with app.app_context():
        existing = User.query.filter_by(email=email).first()
        if existing:
            print(f"Admin account already exists: {email}")
            return

        admin = User(email=email, role="admin", is_verified=True, is_active=True)
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
        print(f"Admin account created: {email}")


if __name__ == "__main__":
    main()
