"""Guards for permanently deleting jobseeker/employer accounts.

This is a government record-keeping system — applications, employment records,
program participation, and job-fair/training history are the actual record of
service delivery and are not ours to destroy on a whim. A hard delete is only
allowed when the account has NO such activity at all (e.g. a duplicate
registration, spam signup, or test account); any account with real history must
be deactivated instead, never permanently erased.
"""

from models.application import Application
from models.employment import EmploymentRecord
from models.jobfair import JobFairBooth, JobFairRegistration
from models.program import ProgramApplication
from models.training import TrainingEnrollment
from models.vacancy import Vacancy


def jobseeker_dependent_counts(profile_id) -> dict:
    return {
        "applications": Application.query.filter_by(jobseeker_profile_id=profile_id).count(),
        "employment_records": EmploymentRecord.query.filter_by(jobseeker_profile_id=profile_id).count(),
        "program_applications": ProgramApplication.query.filter_by(jobseeker_profile_id=profile_id).count(),
        "jobfair_registrations": JobFairRegistration.query.filter_by(jobseeker_profile_id=profile_id).count(),
        "training_enrollments": TrainingEnrollment.query.filter_by(jobseeker_profile_id=profile_id).count(),
    }


def employer_dependent_counts(company_id) -> dict:
    return {
        "vacancies": Vacancy.query.filter_by(employer_company_id=company_id).count(),
        "employment_records": EmploymentRecord.query.filter_by(employer_company_id=company_id).count(),
        "jobfair_booths": JobFairBooth.query.filter_by(employer_company_id=company_id).count(),
    }
