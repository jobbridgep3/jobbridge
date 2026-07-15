"""Import every model here so Flask-Migrate/Alembic can discover the full schema."""

from models.announcement import Announcement
from models.applicant_tools import ApplicationMessage, DocumentRequest, JobOffer
from models.application import Application, ApplicationStatusHistory
from models.audit import AuditTrail
from models.employer import EmployerCompany, EmployerCompanyDocument
from models.employer_hr import EmployerHRDocument, EmployerHRProfile
from models.employment import EmploymentRecord, EmploymentStatusHistory
from models.interview import Interview, InterviewRescheduleRequest
from models.jobfair import JobFair, JobFairBooth, JobFairRegistration
from models.jobseeker import Education, JobseekerDocument, JobseekerProfile, WorkExperience
from models.notification import Notification
from models.otp import OtpCode
from models.program import ProgramApplication
from models.referral import ReferralLetter
from models.settings import SystemSetting
from models.training import TrainingEnrollment, TrainingProgram
from models.user import User
from models.vacancy import Vacancy, VacancyCategory, VacancyScreeningQuestion

__all__ = [
    "User",
    "OtpCode",
    "JobseekerProfile",
    "WorkExperience",
    "Education",
    "JobseekerDocument",
    "EmployerCompany",
    "EmployerCompanyDocument",
    "EmployerHRProfile",
    "EmployerHRDocument",
    "Vacancy",
    "VacancyCategory",
    "VacancyScreeningQuestion",
    "Application",
    "ApplicationStatusHistory",
    "ApplicationMessage",
    "DocumentRequest",
    "JobOffer",
    "Interview",
    "InterviewRescheduleRequest",
    "EmploymentRecord",
    "EmploymentStatusHistory",
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
