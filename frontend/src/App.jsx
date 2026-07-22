import { Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/AppShell'
import { PublicLayout } from './components/public/PublicLayout'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RoleGuard } from './routes/RoleGuard'

import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import Register from './pages/public/Register'
import RegisterChoice from './pages/public/RegisterChoice'
import VerifyOtp from './pages/public/VerifyOtp'
import ForgotPassword from './pages/public/ForgotPassword'
import ResetPassword from './pages/public/ResetPassword'
import CompleteProfile from './pages/public/CompleteProfile'
import PublicAnnouncements from './pages/public/Announcements'
import AnnouncementDetails from './pages/public/AnnouncementDetails'
import PublicJobs from './pages/public/Jobs'
import PublicJobDetail from './pages/public/JobDetail'
import PublicJobFairs from './pages/public/JobFairs'
import PublicJobFairDetail from './pages/public/JobFairDetail'

// Jobseeker
import JobseekerDashboard from './pages/jobseeker/Dashboard'
import JobseekerProfile from './pages/jobseeker/Profile'
import JobseekerJobs from './pages/jobseeker/Jobs'
import JobseekerJobDetail from './pages/jobseeker/JobDetail'
import JobseekerApplications from './pages/jobseeker/Applications'
import JobseekerEmployment from './pages/jobseeker/Employment'
import JobseekerInterviews from './pages/jobseeker/Interviews'
import JobseekerJobFair from './pages/jobseeker/JobFair'
import JobseekerJobFairDetail from './pages/jobseeker/JobFairDetail'
import JobseekerSPES from './pages/jobseeker/SPES'
import JobseekerTraining from './pages/jobseeker/Training'
import JobseekerDILP from './pages/jobseeker/DILP'
import JobseekerOWWA from './pages/jobseeker/OWWA'
import JobseekerNotifications from './pages/jobseeker/Notifications'
import JobseekerSettings from './pages/jobseeker/Settings'

// Employer
import EmployerDashboard from './pages/employer/Dashboard'
import EmployerProfile from './pages/employer/Profile'
import EmployerCompany from './pages/employer/Company'
import EmployerVacancies from './pages/employer/Vacancies'
import EmployerVacancyForm from './pages/employer/VacancyForm'
import EmployerApplicants from './pages/employer/Applicants'
import EmployerApplicantDetail from './pages/employer/ApplicantDetail'
import EmployerReferrals from './pages/employer/Referrals'
import EmployerReferralDetail from './pages/employer/ReferralDetail'
import EmployerInterviews from './pages/employer/Interviews'
import EmployerJobFair from './pages/employer/JobFair'
import EmployerJobFairBooth from './pages/employer/JobFairBooth'
import EmployerEmployment from './pages/employer/Employment'
import EmployerNotifications from './pages/employer/Notifications'
import EmployerSettings from './pages/employer/Settings'

// PESO Staff
import StaffDashboard from './pages/staff/Dashboard'
import StaffJobseekers from './pages/staff/Jobseekers'
import StaffJobseekerDetail from './pages/staff/JobseekerDetail'
import StaffEmployers from './pages/staff/Employers'
import StaffEmployerDetail from './pages/staff/EmployerDetail'
import StaffVacancies from './pages/staff/Vacancies'
import StaffVacancyDetail from './pages/staff/VacancyDetail'
import StaffInterviews from './pages/staff/Interviews'
import StaffReferralLetters from './pages/staff/ReferralLetters'
import StaffEmployment from './pages/staff/Employment'
import StaffJobFair from './pages/staff/JobFair'
import StaffJobFairScanner from './pages/staff/JobFairScanner'
import StaffTraining from './pages/staff/Training'
import StaffDILP from './pages/staff/DILP'
import StaffOWWA from './pages/staff/OWWA'
import StaffSPES from './pages/staff/SPES'
import StaffLMI from './pages/staff/LMI'
import StaffAnnouncements from './pages/staff/Announcements'
import StaffNotifications from './pages/staff/Notifications'
import StaffSettings from './pages/staff/Settings'

// Admin
import AdminDashboard from './pages/admin/Dashboard'
import AdminJobseekers from './pages/admin/Jobseekers'
import AdminJobseekerDetail from './pages/admin/JobseekerDetail'
import AdminEmployers from './pages/admin/Employers'
import AdminEmployerDetail from './pages/admin/EmployerDetail'
import AdminStaff from './pages/admin/Staff'
import AdminStaffCreate from './pages/admin/StaffCreate'
import AdminVacancies from './pages/admin/Vacancies'
import AdminVacancyDetail from './pages/admin/VacancyDetail'
import AdminInterviews from './pages/admin/Interviews'
import AdminReferralLetters from './pages/admin/ReferralLetters'
import AdminEmployment from './pages/admin/Employment'
import AdminJobFair from './pages/admin/JobFair'
import AdminJobFairScanner from './pages/admin/JobFairScanner'
import AdminTraining from './pages/admin/Training'
import AdminDILP from './pages/admin/DILP'
import AdminOWWA from './pages/admin/OWWA'
import AdminSPES from './pages/admin/SPES'
import AdminLMI from './pages/admin/LMI'
import AdminAnnouncements from './pages/admin/Announcements'
import AdminAuditTrail from './pages/admin/AuditTrail'
import AdminNotifications from './pages/admin/Notifications'
import AdminSettings from './pages/admin/Settings'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/jobs" element={<PublicJobs />} />
        <Route path="/jobs/:id" element={<PublicJobDetail />} />
        <Route path="/job-fair" element={<PublicJobFairs />} />
        <Route path="/job-fair/:id" element={<PublicJobFairDetail />} />
        <Route path="/announcements" element={<PublicAnnouncements />} />
        <Route path="/announcements/:id" element={<AnnouncementDetails />} />
        <Route path="*" element={<Landing />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register/choose" element={<RegisterChoice />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />

      <Route element={<ProtectedRoute />}>
        {/* Jobseeker */}
        <Route element={<RoleGuard allowedRole="jobseeker" />}>
          <Route path="/jobseeker" element={<AppShell />}>
            <Route path="dashboard" element={<JobseekerDashboard />} />
            <Route path="profile" element={<JobseekerProfile />} />
            <Route path="jobs" element={<JobseekerJobs />} />
            <Route path="jobs/:id" element={<JobseekerJobDetail />} />
            <Route path="applications" element={<JobseekerApplications />} />
            <Route path="employment" element={<JobseekerEmployment />} />
            <Route path="interviews" element={<JobseekerInterviews />} />
            <Route path="jobfair" element={<JobseekerJobFair />} />
            <Route path="jobfair/:id" element={<JobseekerJobFairDetail />} />
            <Route path="spes" element={<JobseekerSPES />} />
            <Route path="training" element={<JobseekerTraining />} />
            <Route path="dilp" element={<JobseekerDILP />} />
            <Route path="owwa" element={<JobseekerOWWA />} />
            <Route path="notifications" element={<JobseekerNotifications />} />
            <Route path="settings" element={<JobseekerSettings />} />
          </Route>
        </Route>

        {/* Employer */}
        <Route element={<RoleGuard allowedRole="employer" />}>
          <Route path="/employer" element={<AppShell />}>
            <Route path="dashboard" element={<EmployerDashboard />} />
            <Route path="profile" element={<EmployerProfile />} />
            <Route path="company" element={<EmployerCompany />} />
            <Route path="vacancies" element={<EmployerVacancies />} />
            <Route path="vacancies/create" element={<EmployerVacancyForm />} />
            <Route path="vacancies/:id/edit" element={<EmployerVacancyForm />} />
            <Route path="applicants" element={<EmployerApplicants />} />
            <Route path="applicants/:id" element={<EmployerApplicantDetail />} />
            <Route path="referrals" element={<EmployerReferrals />} />
            <Route path="referrals/:id" element={<EmployerReferralDetail />} />
            <Route path="interviews" element={<EmployerInterviews />} />
            <Route path="jobfair" element={<EmployerJobFair />} />
            <Route path="jobfair/:id/booth" element={<EmployerJobFairBooth />} />
            <Route path="employment" element={<EmployerEmployment />} />
            <Route path="notifications" element={<EmployerNotifications />} />
            <Route path="settings" element={<EmployerSettings />} />
          </Route>
        </Route>

        {/* PESO Staff */}
        <Route element={<RoleGuard allowedRole="staff" />}>
          <Route path="/staff" element={<AppShell />}>
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="jobseekers" element={<StaffJobseekers />} />
            <Route path="jobseekers/:id" element={<StaffJobseekerDetail />} />
            <Route path="employers" element={<StaffEmployers />} />
            <Route path="employers/:id" element={<StaffEmployerDetail />} />
            <Route path="vacancies" element={<StaffVacancies />} />
            <Route path="vacancies/:id" element={<StaffVacancyDetail />} />
            <Route path="interviews" element={<StaffInterviews />} />
            <Route path="referrals" element={<StaffReferralLetters />} />
            <Route path="employment" element={<StaffEmployment />} />
            <Route path="jobfair" element={<StaffJobFair />} />
            <Route path="jobfair/:id/scanner" element={<StaffJobFairScanner />} />
            <Route path="training" element={<StaffTraining />} />
            <Route path="dilp" element={<StaffDILP />} />
            <Route path="owwa" element={<StaffOWWA />} />
            <Route path="spes" element={<StaffSPES />} />
            <Route path="lmi" element={<StaffLMI />} />
            <Route path="announcements" element={<StaffAnnouncements />} />
            <Route path="notifications" element={<StaffNotifications />} />
            <Route path="settings" element={<StaffSettings />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<RoleGuard allowedRole="admin" />}>
          <Route path="/admin" element={<AppShell />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="jobseekers" element={<AdminJobseekers />} />
            <Route path="jobseekers/:id" element={<AdminJobseekerDetail />} />
            <Route path="employers" element={<AdminEmployers />} />
            <Route path="employers/:id" element={<AdminEmployerDetail />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="staff/create" element={<AdminStaffCreate />} />
            <Route path="vacancies" element={<AdminVacancies />} />
            <Route path="vacancies/:id" element={<AdminVacancyDetail />} />
            <Route path="interviews" element={<AdminInterviews />} />
            <Route path="referrals" element={<AdminReferralLetters />} />
            <Route path="employment" element={<AdminEmployment />} />
            <Route path="jobfair" element={<AdminJobFair />} />
            <Route path="jobfair/:id/scanner" element={<AdminJobFairScanner />} />
            <Route path="training" element={<AdminTraining />} />
            <Route path="dilp" element={<AdminDILP />} />
            <Route path="owwa" element={<AdminOWWA />} />
            <Route path="spes" element={<AdminSPES />} />
            <Route path="lmi" element={<AdminLMI />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="audit" element={<AdminAuditTrail />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
