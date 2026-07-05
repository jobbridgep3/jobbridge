import logging

from flask import Flask

from config import Config
from extensions import cors, db, jwt, limiter, migrate, socketio
from utils.responses import fail

logging.basicConfig(level=logging.INFO)


def create_app(config_object=Config):
    app = Flask(__name__)
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

    _register_blueprints(app)
    _register_error_handlers(app)

    if app.config["ENV"] != "testing":
        from scheduler import init_scheduler

        init_scheduler(app)

    return app


def _register_blueprints(app: Flask):
    from blueprints.admin import admin_bp
    from blueprints.auth import account_bp, auth_bp
    from blueprints.announcements import announcements_bp
    from blueprints.chatbot import chatbot_bp
    from blueprints.employer import applicants_bp, company_bp, employer_bp, vacancies_bp
    from blueprints.employment import employment_bp
    from blueprints.health import health_bp
    from blueprints.interviews import interviews_bp
    from blueprints.jobfair import jobfair_bp, staff_jobfair_bp
    from blueprints.jobs import jobs_bp
    from blueprints.lmi import lmi_bp
    from blueprints.notifications import notifications_bp
    from blueprints.profile import profile_bp
    from blueprints.programs import programs_bp
    from blueprints.settings import admin_settings_bp, settings_bp
    from blueprints.staff import staff_bp
    from blueprints.training import staff_training_bp, training_bp

    for bp in (
        auth_bp, account_bp,
        health_bp, profile_bp, jobs_bp, interviews_bp, employment_bp,
        jobfair_bp, staff_jobfair_bp, programs_bp, training_bp, staff_training_bp,
        notifications_bp, settings_bp, admin_settings_bp,
        employer_bp, company_bp, vacancies_bp, applicants_bp,
        staff_bp, lmi_bp, admin_bp, announcements_bp, chatbot_bp,
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
    socketio.run(app, host="0.0.0.0", port=5000, debug=app.config["DEBUG"])
