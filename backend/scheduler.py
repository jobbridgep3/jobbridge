import logging

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="Asia/Manila")


def _generate_monthly_lmi_report(app):
    with app.app_context():
        logger.info("APScheduler: generating monthly LMI aggregation snapshot.")
        # Aggregation itself is computed on-demand by /api/staff/lmi/stats; this job
        # exists as the documented monthly trigger point for future persisted snapshots.


def init_scheduler(app):
    if scheduler.running:
        return
    scheduler.add_job(
        lambda: _generate_monthly_lmi_report(app),
        trigger="cron", day=1, hour=0, id="monthly_lmi_report", replace_existing=True,
    )
    scheduler.start()
