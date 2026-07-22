import logging

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix

from config import Config
from extensions import cors, db, jwt, limiter, migrate, socketio
from utils.responses import fail

logging.basicConfig(level=logging.INFO)


def create_app(config_object=Config):
    app = Flask(__name__)
    # Render sits the app behind its own proxy (Cloudflare -> Render's router -> gunicorn),
    # so request.remote_addr is Render's internal proxy IP for every request unless we trust
    # the X-Forwarded-For header it sets. Without this, Flask-Limiter's per-IP rate limits
    # (e.g. login's 5-per-15-minutes) bucket ALL users together under one key, since they all
    # appear to share the same "IP" — one hop of real traffic, hence x_for=1.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    app.config.from_object(config_object)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=True)
    socketio.init_app(app)

    with app.app_context():
        import models  # noqa: F401  (registers all models with SQLAlchemy metadata)
        import sockets.events  # noqa: F401  (registers Socket.io handlers)

        # Eagerly built/loaded once at boot (not lazily inside a request) so their
        # one-time cost (gRPC channel handshake, spaCy model load) never counts toward
        # a resume-upload request's time budget — see services/ocr_service.py's
        # module docstring for why this matters for the eventlet worker.
        from services.nlp_service import preload_nlp_model
        from services.ocr_service import init_vision_client

        init_vision_client(app)
        preload_nlp_model()

    _register_blueprints(app)
    _register_error_handlers(app)

    if app.config["ENV"] != "testing":
        from scheduler import init_scheduler

        init_scheduler(app)

    return app


def _register_blueprints(app: Flask):
    from blueprints.admin import admin_bp
    from blueprints.applicant_tools import applicant_tools_bp
    from blueprints.auth import account_bp, auth_bp
    from blueprints.announcements import announcements_bp
    from blueprints.chatbot import chatbot_bp
    from blueprints.employer import applicants_bp, company_bp, employer_bp, vacancies_bp
    from blueprints.employer_referrals import employer_referrals_bp
    from blueprints.employment import employment_bp
    from blueprints.health import health_bp
    from blueprints.interviews import interviews_bp
    from blueprints.jobfair import jobfair_bp, staff_jobfair_bp
    from blueprints.jobs import jobs_bp
    from blueprints.lmi import lmi_bp
    from blueprints.lookups import lookups_bp
    from blueprints.notifications import notifications_bp
    from blueprints.profile import profile_bp
    from blueprints.programs import programs_bp
    from blueprints.public_home import public_home_bp
    from blueprints.referrals import referrals_bp
    from blueprints.settings import admin_settings_bp, settings_bp
    from blueprints.staff import staff_bp
    from blueprints.training import staff_training_bp, training_bp

    for bp in (
        auth_bp, account_bp,
        health_bp, profile_bp, jobs_bp, interviews_bp, employment_bp,
        jobfair_bp, staff_jobfair_bp, programs_bp, referrals_bp, training_bp, staff_training_bp,
        notifications_bp, settings_bp, admin_settings_bp,
        employer_bp, company_bp, vacancies_bp, applicants_bp, applicant_tools_bp, employer_referrals_bp,
        staff_bp, lmi_bp, admin_bp, announcements_bp, chatbot_bp, lookups_bp, public_home_bp,
    ):
        app.register_blueprint(bp)


def _register_error_handlers(app: Flask):
    @app.errorhandler(404)
    def not_found(_):
        return fail("The requested resource was not found.", 404)

    @app.errorhandler(429)
    def rate_limited(_):
        return fail("Too many requests. Please try again later.", 429)

    @app.errorhandler(500)
    def server_error(exc):
        app.logger.error("Unhandled server error: %s", exc, exc_info=True)
        return fail("An unexpected error occurred. Please try again later.", 500)


app = create_app()

if __name__ == "__main__":
    # use_reloader=False: Werkzeug's auto-reloader forks/restarts the process on
    # file changes, and is documented as incompatible with eventlet's own socket
    # monkey-patching — the reloader's SIGINT/restart races with eventlet's hub
    # closing file descriptors it still holds, producing the "[Errno 9] Bad file
    # descriptor" traceback on shutdown/reload. This only affects this local-dev
    # entrypoint; production (render.yaml) runs via gunicorn+eventlet through
    # run.py, a separate path that never invokes the Werkzeug reloader.
    try:
        socketio.run(app, host="0.0.0.0", port=5000, debug=app.config["DEBUG"], use_reloader=False)
    except OSError as exc:
        logging.getLogger(__name__).info("Socket.IO dev server shut down: %s", exc)
