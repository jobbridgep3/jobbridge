import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

REQUIRED_VARS = [
    "DATABASE_URL",
    "JWT_SECRET_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "BREVO_API_KEY",
    "BREVO_SENDER_EMAIL",
    "RECAPTCHA_SECRET_KEY",
]


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value and os.environ.get("FLASK_ENV") == "production":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value or ""


class Config:
    # --- Core ---
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = ENV == "development"
    SECRET_KEY = os.environ.get("SECRET_KEY", os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me"))

    # --- Database (SQLAlchemy -> Supabase Postgres via session pooler) ---
    SQLALCHEMY_DATABASE_URI = _require("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # NOTE: do not set "poolclass" here. Flask-SQLAlchemy merges this dict onto
    # extensions.py's `engine_options` via dict.update(), so any "poolclass" key here
    # — even explicit None — clobbers extensions.py's NullPool. SQLAlchemy's
    # create_engine() treats poolclass=None as "unspecified" and silently falls back
    # to the default QueuePool(pool_size=5, max_overflow=10): up to 15 real
    # connections from this ONE worker process alone, which was exactly exhausting
    # Supabase's session-pooler budget (error: "max clients ... pool_size: 15").
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    }

    # --- JWT ---
    JWT_SECRET_KEY = _require("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ["headers"]

    # --- Supabase (Storage only) ---
    SUPABASE_URL = _require("SUPABASE_URL")
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = _require("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "jobbridge-files")

    # --- Mail (Brevo transactional email API — avoids SMTP port blocking on cloud hosts) ---
    BREVO_API_KEY = _require("BREVO_API_KEY")
    BREVO_SENDER_EMAIL = _require("BREVO_SENDER_EMAIL")
    BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME", "JobBridge PESO Pila")

    # --- reCAPTCHA v2 (login) ---
    RECAPTCHA_SECRET_KEY = _require("RECAPTCHA_SECRET_KEY")

    # --- CORS ---
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

    # --- Frontend (for building absolute links in emails, e.g. "Go to Dashboard"
    # buttons) — set to the deployed Render frontend URL in production. ---
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # --- AI service credentials (optional — stub mode when absent) ---
    # Vision and Dialogflow live in separate GCP projects/service accounts here, so each
    # gets its own credential file rather than sharing GOOGLE_APPLICATION_CREDENTIALS.
    GOOGLE_APPLICATION_CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    # Base64-encoded service-account JSON — used in place of a file path where the
    # credentials file can't be delivered to disk (e.g. Render, whose builds start from
    # a fresh git clone with no way to place a git-ignored secret file on it).
    GOOGLE_APPLICATION_CREDENTIALS_JSON = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON", "")
    DIALOGFLOW_PROJECT_ID = os.environ.get("DIALOGFLOW_PROJECT_ID", "")
    DIALOGFLOW_CREDENTIALS_PATH = os.environ.get("DIALOGFLOW_CREDENTIALS_PATH", "")

    # --- Admin seed (used only by seed.py) ---
    ADMIN_SEED_EMAIL = os.environ.get("ADMIN_SEED_EMAIL", "")
    ADMIN_SEED_PASSWORD = os.environ.get("ADMIN_SEED_PASSWORD", "")

    # --- Rate limiting ---
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # --- Misc ---
    TIMEZONE = "Asia/Manila"
    MAINTENANCE_MODE = os.environ.get("MAINTENANCE_MODE", "false").lower() == "true"
