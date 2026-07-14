import dayjs from 'dayjs'
import {
  Award, Briefcase, Building2, CalendarDays, CheckCircle2, Clock, FileText, Globe, GraduationCap,
  Heart, ListChecks, Mail, MapPin, Phone, ShieldCheck, User, Users, Wallet,
} from 'lucide-react'

import { Badge } from '../ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { formatSalaryRange } from '../../lib/salaryFormat'

function Section({ icon: Icon, title, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary-600" />} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  )
}

function formatAddress(entity) {
  return [entity.street_address, entity.barangay_name, entity.city_municipality_name, entity.province_name, entity.region_name, entity.zip_code]
    .filter(Boolean)
    .join(', ')
}

function formatDate(iso) {
  return iso ? dayjs(iso).format('MMM D, YYYY') : null
}

/**
 * Full "job posting" style display of a vacancy — every field, sectioned and
 * consistently styled. Shared by the employer's own Preview, the Staff/Admin
 * vacancy detail view, and the jobseeker-facing job detail page, so all three
 * always show exactly the same information instead of three divergent
 * one-off renders.
 *
 * `vacancy` — shaped like Vacancy.to_dict(). `company`/`hrProfile` are
 * optional full EmployerCompany.to_dict()/EmployerHRProfile.to_dict()
 * payloads — pass them only where the viewer is entitled to see that much
 * (Staff/Admin); omit for the public-facing jobseeker view, which only ever
 * sees the company_name/company_logo_url already embedded in `vacancy`.
 */
export function VacancyDisplay({ vacancy, company, hrProfile, matchScore, slotsRemaining, companyVerified }) {
  const v = vacancy
  const hasQualifications = v.education_level || v.course || v.min_experience_years != null || v.fresh_grad_ok || v.required_skills?.length || v.required_certifications?.length
  const hasPreferences = v.pref_age_min || v.pref_age_max || v.pref_gender || v.pref_civil_status || v.pref_languages?.length
    || v.fresh_grad_friendly || v.pwd_friendly || v.senior_citizen_friendly || v.ofw_friendly
  const hasContact = v.contact_name || v.contact_email || v.contact_number
  const hasAdditional = v.culture_description || v.career_growth_description || v.additional_notes
  const location = [v.work_location, formatAddress(v)].filter(Boolean).join(' — ')

  return (
    <div className="space-y-4">
      {/* Company header */}
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {v.company_logo_url ? (
                <img src={v.company_logo_url} alt={v.company_name} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-6 w-6 text-slate-300" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{v.title || 'Untitled Vacancy'}</h1>
              <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                <span>{v.company_name || 'Unnamed Company'}</span>
                {companyVerified && (
                  <Badge variant="success" className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> PESO-Accredited
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {matchScore != null && (
            <Badge variant="primary" className="text-sm">{matchScore}% Match</Badge>
          )}
        </CardContent>
      </Card>

      {/* Job at a glance */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Wallet className="h-4 w-4 shrink-0 text-slate-400" /> {formatSalaryRange(v.salary_min, v.salary_max, v.hide_salary)}
          </div>
          {v.job_type && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Briefcase className="h-4 w-4 shrink-0 text-slate-400" /> {v.job_type.replace(/_/g, ' ')}
            </div>
          )}
          {v.work_arrangement && (
            <div className="flex items-center gap-2 text-sm text-slate-700 capitalize">
              <Globe className="h-4 w-4 shrink-0 text-slate-400" /> {v.work_arrangement}
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" /> {location}
            </div>
          )}
          {v.schedule && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" /> {v.schedule}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Users className="h-4 w-4 shrink-0 text-slate-400" />
            {slotsRemaining != null ? `${slotsRemaining} of ${v.num_slots} slot(s) remaining` : `${v.num_slots ?? 1} opening(s)`}
          </div>
          {v.category_name && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <ListChecks className="h-4 w-4 shrink-0 text-slate-400" /> {v.category_name}
            </div>
          )}
          {v.industry && <div className="flex items-center gap-2 text-sm text-slate-700"><Building2 className="h-4 w-4 shrink-0 text-slate-400" /> {v.industry}</div>}
          {v.department && <div className="flex items-center gap-2 text-sm text-slate-700"><Briefcase className="h-4 w-4 shrink-0 text-slate-400" /> {v.department} Dept.</div>}
          {v.vacancy_no && <div className="flex items-center gap-2 text-sm text-slate-700"><FileText className="h-4 w-4 shrink-0 text-slate-400" /> Ref# {v.vacancy_no}</div>}
        </CardContent>
      </Card>

      {(v.summary || v.responsibilities || v.daily_tasks || v.description) && (
        <Section icon={FileText} title="Job Description">
          {v.summary && <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: v.summary }} />}
          {v.responsibilities && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Duties &amp; Responsibilities</h4>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: v.responsibilities }} />
            </div>
          )}
          {v.daily_tasks && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Daily Tasks</h4>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: v.daily_tasks }} />
            </div>
          )}
          {!v.summary && !v.responsibilities && v.description && (
            <p className="whitespace-pre-line text-sm text-slate-600">{v.description}</p>
          )}
        </Section>
      )}

      {hasQualifications && (
        <Section icon={GraduationCap} title="Qualifications">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow label="Education Level" value={v.education_level} />
            <InfoRow label="Course/Program" value={v.course} />
            <InfoRow label="Minimum Experience" value={v.min_experience_years != null ? `${v.min_experience_years} yrs` : null} />
            <InfoRow label="Fresh Graduates" value={v.fresh_grad_ok ? 'Welcome to apply' : null} />
          </div>
          {v.required_skills?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">Skills Required</p>
              <div className="flex flex-wrap gap-1.5">{v.required_skills.map((s) => <Badge key={s}>{s}</Badge>)}</div>
            </div>
          )}
          {v.required_certifications?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">Certifications</p>
              <div className="flex flex-wrap gap-1.5">{v.required_certifications.map((c) => <Badge key={c} variant="info">{c}</Badge>)}</div>
            </div>
          )}
        </Section>
      )}

      {v.benefits?.length > 0 && (
        <Section icon={Heart} title="Benefits">
          <div className="flex flex-wrap gap-2">{v.benefits.map((b) => <Badge key={b} variant="success">{b}</Badge>)}</div>
        </Section>
      )}

      {hasPreferences && (
        <Section icon={Users} title="Applicant Preferences">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow label="Age Range" value={v.pref_age_min || v.pref_age_max ? `${v.pref_age_min ?? 'Any'} – ${v.pref_age_max ?? 'Any'}` : null} />
            <InfoRow label="Gender" value={v.pref_gender} />
            <InfoRow label="Civil Status" value={v.pref_civil_status} />
            <InfoRow label="Languages" value={v.pref_languages?.length ? v.pref_languages.join(', ') : null} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {v.fresh_grad_friendly && <Badge variant="info">Fresh-grad friendly</Badge>}
            {v.pwd_friendly && <Badge variant="info">PWD friendly</Badge>}
            {v.senior_citizen_friendly && <Badge variant="info">Senior-citizen friendly</Badge>}
            {v.ofw_friendly && <Badge variant="info">OFW friendly</Badge>}
          </div>
        </Section>
      )}

      {(v.posting_date || v.application_deadline || v.expected_start_date) && (
        <Section icon={CalendarDays} title="Hiring Dates">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InfoRow label="Posting Date" value={formatDate(v.posting_date)} />
            <InfoRow label="Application Deadline" value={formatDate(v.application_deadline)} />
            <InfoRow label="Expected Start Date" value={formatDate(v.expected_start_date)} />
          </div>
        </Section>
      )}

      {v.required_applicant_documents?.length > 0 && (
        <Section icon={CheckCircle2} title="Required Documents">
          <div className="flex flex-wrap gap-1.5">{v.required_applicant_documents.map((d) => <Badge key={d}>{d}</Badge>)}</div>
        </Section>
      )}

      {v.screening_questions?.length > 0 && (
        <Section icon={ListChecks} title="Screening Questions">
          <ol className="list-decimal space-y-2 pl-4 text-sm text-slate-700">
            {v.screening_questions.map((q, i) => (
              <li key={i}>
                {q.question_text} {q.is_required && <span className="text-red-500">*</span>}
                {q.question_type === 'multiple_choice' && q.options?.length > 0 && (
                  <span className="block text-xs text-slate-400">Options: {q.options.join(', ')}</span>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {hasContact && (
        <Section icon={User} title="Contact Person">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InfoRow label="Name" value={v.contact_name} />
            {v.contact_email && (
              <div>
                <p className="text-xs font-medium text-slate-400">Email</p>
                <p className="flex items-center gap-1 text-sm text-slate-800"><Mail className="h-3.5 w-3.5 text-slate-400" /> {v.contact_email}</p>
              </div>
            )}
            {v.contact_number && (
              <div>
                <p className="text-xs font-medium text-slate-400">Phone</p>
                <p className="flex items-center gap-1 text-sm text-slate-800"><Phone className="h-3.5 w-3.5 text-slate-400" /> {v.contact_number}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {hasAdditional && (
        <Section icon={Award} title="Additional Information">
          {v.culture_description && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Company Culture</h4>
              <p className="whitespace-pre-line text-sm text-slate-600">{v.culture_description}</p>
            </div>
          )}
          {v.career_growth_description && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Career Growth</h4>
              <p className="whitespace-pre-line text-sm text-slate-600">{v.career_growth_description}</p>
            </div>
          )}
          {v.additional_notes && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Additional Notes</h4>
              <p className="whitespace-pre-line text-sm text-slate-600">{v.additional_notes}</p>
            </div>
          )}
        </Section>
      )}

      {company && (
        <Section icon={Building2} title="Company Information">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow label="Trade Name" value={company.trade_name} />
            <InfoRow label="Business Type" value={company.business_type?.replace(/_/g, ' ')} />
            <InfoRow label="Industry" value={company.industry} />
            <InfoRow label="Nature of Business" value={company.nature_of_business} />
            <InfoRow label="Company Size" value={company.company_size} />
            <InfoRow label="Website" value={company.website} />
            <InfoRow label="Company Email" value={company.company_email} />
            <InfoRow label="Contact Number" value={company.contact_number} />
            <InfoRow label="Address" value={formatAddress(company)} />
            <InfoRow label="Accreditation Status" value={company.accreditation_status?.replace(/_/g, ' ')} />
          </div>
          {company.description && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700">About the Company</h4>
              <p className="whitespace-pre-line text-sm text-slate-600">{company.description}</p>
            </div>
          )}
        </Section>
      )}

      {hrProfile && (
        <Section icon={User} title="HR Information">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow label="Full Name" value={hrProfile.full_name} />
            <InfoRow label="Position" value={hrProfile.position} />
            <InfoRow label="Department" value={hrProfile.department} />
            <InfoRow label="Employment Status" value={hrProfile.employment_status} />
            <InfoRow label="Personal Email" value={hrProfile.personal_email} />
            <InfoRow label="Mobile Number" value={hrProfile.mobile_number} />
          </div>
        </Section>
      )}
    </div>
  )
}
