import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

REQUIRED_VARS = [
    "DATABASE_URL",
    "JWT_SECRET_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "MAIL_USERNAME",
    "MAIL_PASSWORD",
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
    SQLALCHEMY_ENGINE_OPTIONS = {
        "poolclass": None,  # set to NullPool in extensions.py (Supabase pooler already pools)
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

    # --- Mail (Gmail SMTP) ---
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = _require("MAIL_USERNAME")
    MAIL_PASSWORD = _require("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = ("JobBridge PESO Pila", os.environ.get("MAIL_USERNAME", ""))

    # --- CORS ---
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

    # --- AI service credentials (optional — stub mode when absent) ---
    GOOGLE_APPLICATION_CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    DIALOGFLOW_PROJECT_ID = os.environ.get("DIALOGFLOW_PROJECT_ID", "")

    # --- Admin seed (used only by seed.py) ---
    ADMIN_SEED_EMAIL = os.environ.get("ADMIN_SEED_EMAIL", "")
    ADMIN_SEED_PASSWORD = os.environ.get("ADMIN_SEED_PASSWORD", "")

    # --- Rate limiting ---
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # --- Misc ---
    TIMEZONE = "Asia/Manila"
    MAINTENANCE_MODE = os.environ.get("MAINTENANCE_MODE", "false").lower() == "true"
