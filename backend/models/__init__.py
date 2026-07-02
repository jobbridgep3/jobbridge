"""Import every model here so Flask-Migrate/Alembic can discover the full schema."""

from models.announcement import Announcement
from models.application import Application
from models.audit import AuditTrail
from models.employer import EmployerCompany
from models.employment import EmploymentRecord
from models.interview import Interview
from models.jobfair import JobFair, JobFairBooth, JobFairRegistration
from models.jobseeker import Education, JobseekerProfile, WorkExperience
from models.notification import Notification
from models.otp import OtpCode
from models.program import ProgramApplication
from models.referral import ReferralLetter
from models.settings import SystemSetting
from models.training import TrainingEnrollment, TrainingProgram
from models.user import User
from models.vacancy import Vacancy

__all__ = [
    "User",
    "OtpCode",
    "JobseekerProfile",
    "WorkExperience",
    "Education",
    "EmployerCompany",
    "Vacancy",
    "Application",
    "Interview",
    "EmploymentRecord",
    "ReferralLetter",
    "JobFair",
    "JobFairRegistration",
    "JobFairBooth",
    "TrainingProgram",
    "TrainingEnrollment",
    "ProgramApplication",
    "Announcement",
    "Notification",
    "AuditTrail",
    "SystemSetting",
]
