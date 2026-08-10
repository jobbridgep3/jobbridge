// Merges Gemini's resume extraction (see backend/services/gemini_resume_service.py's
// response shape) into the profile form — pure, no side effects. Every rule here exists
// to satisfy one hard requirement: never silently overwrite something the user already
// entered, and never write a value that could later fail Save validation.

import { ATTAINMENT_LEVELS, CIVIL_STATUSES, EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, GENDERS } from './options'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const YEAR_RE = /^\d{4}$/
const MAX_ENTRIES = 10

const cleanText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const cleanDate = (value) => (typeof value === 'string' && ISO_DATE_RE.test(value.trim()) ? value.trim() : null)
const cleanYear = (value) => (typeof value === 'string' && YEAR_RE.test(value.trim()) ? value.trim() : null)
const norm = (value) => (value || '').trim().toLowerCase()

// Only accepted if it exactly (case-insensitively) matches one of the backend's allowed
// values — schemas/jobseeker_schemas.py validates these with OneOf, so anything else
// would fail the whole Save request rather than just being ignored for this one field.
function matchEnum(value, options) {
  const text = cleanText(value)
  if (!text) return null
  return options.find((o) => o.toLowerCase() === text.toLowerCase()) || null
}

/** True if the raw extraction has nothing usable anywhere — judged against the
 * extraction itself, not against what's already in the form, so a resume that happens
 * to match an already-complete profile still counts as a real (if uneventful) success. */
export function isExtractionEmpty(extracted) {
  const personal = extracted?.personal_information || {}
  const employment = extracted?.employment_information || {}
  const skills = extracted?.skills || {}

  const anyPersonal = Object.entries(personal).some(([key, value]) => key !== 'email' && cleanText(value))
  const anyEducation = (extracted?.educational_background || []).some((e) => cleanText(e?.school_name))
  const anyEmployment = Object.entries(employment).some(([key, value]) => key !== 'work_experience' && cleanText(value))
  const anyWorkExperience = (employment.work_experience || []).some((w) => cleanText(w?.company) || cleanText(w?.position))
  const anySkills = Object.values(skills).some((list) => Array.isArray(list) && list.some((s) => cleanText(s)))

  return !anyPersonal && !anyEducation && !anyEmployment && !anyWorkExperience && !anySkills
}

export function mergeExtractedIntoForm(form, extracted) {
  const next = { ...form }
  const highlightedKeys = new Set()

  const fillText = (key, rawValue) => {
    const value = cleanText(rawValue)
    if (value && !cleanText(next[key])) {
      next[key] = value
      highlightedKeys.add(key)
    }
  }
  const fillEnum = (key, rawValue, options) => {
    const value = matchEnum(rawValue, options)
    if (value && !cleanText(next[key])) {
      next[key] = value
      highlightedKeys.add(key)
    }
  }
  const fillDate = (key, rawValue) => {
    const value = cleanDate(rawValue)
    if (value && !next[key]) {
      next[key] = value
      highlightedKeys.add(key)
    }
  }

  const personal = extracted?.personal_information || {}
  fillText('full_name', personal.full_name)
  fillText('contact_number', personal.contact_number)
  fillDate('date_of_birth', personal.date_of_birth)
  fillEnum('gender', personal.gender, GENDERS)
  fillEnum('civil_status', personal.civil_status, CIVIL_STATUSES)
  fillText('nationality', personal.nationality)
  fillText('barangay', personal.barangay)
  fillText('municipality', personal.municipality)
  fillText('province', personal.province)
  fillText('region_name', personal.region)
  fillText('zip_code', personal.zip_code)
  // personal.email is intentionally never merged — read-only, tied to the login account
  // (same rule the old OCR pipeline followed; the Email input is permanently disabled).

  const employment = extracted?.employment_information || {}
  fillEnum('employment_status', employment.employment_status, EMPLOYMENT_STATUSES)
  fillEnum('employment_type', employment.employment_type_preferred, EMPLOYMENT_TYPES)
  fillText('preferred_job_position', employment.preferred_job_position)
  fillText('preferred_industry', employment.preferred_industry)
  fillText('preferred_work_location', employment.preferred_work_location)
  fillText('expected_salary', employment.expected_salary)

  // Skills: union into the existing array (never removes anything already there),
  // case-insensitively deduped so e.g. an extracted "excel" doesn't sit alongside an
  // existing "Excel" as a separate chip — existing entries' casing wins on a collision.
  // The group is only highlighted if it was empty before this upload.
  const skills = extracted?.skills || {}
  for (const key of ['technical_skills', 'soft_skills', 'languages_spoken', 'certifications']) {
    const additions = (skills[key] || []).map(cleanText).filter(Boolean)
    if (!additions.length) continue
    const existing = next[key] || []
    if (!existing.length) highlightedKeys.add(key)
    const byLowerCase = new Map()
    for (const item of [...existing, ...additions]) {
      const lower = item.toLowerCase()
      if (!byLowerCase.has(lower)) byLowerCase.set(lower, item)
    }
    next[key] = [...byLowerCase.values()].sort()
  }

  // Education: append new, non-duplicate entries only — existing ones are never touched.
  const existingEdu = next.educations || []
  const newEdu = []
  for (const entry of extracted?.educational_background || []) {
    if (existingEdu.length + newEdu.length >= MAX_ENTRIES) break
    const school = cleanText(entry?.school_name)
    if (!school) continue
    const candidate = {
      school,
      degree: cleanText(entry.course) || '',
      graduation_year: cleanYear(entry.year) || '',
      attainment_level: matchEnum(entry.level, ATTAINMENT_LEVELS) || '',
      honors: cleanText(entry.honors) || '',
      _highlighted: true,
    }
    const isDuplicate = [...existingEdu, ...newEdu].some(
      (e) => norm(e.school) === norm(candidate.school) && norm(e.degree) === norm(candidate.degree)
    )
    if (!isDuplicate) newEdu.push(candidate)
  }
  if (newEdu.length) next.educations = [...existingEdu, ...newEdu]

  // Work experience: same append-if-new pattern. `description` is part of Gemini's
  // schema but has no editable field anywhere in the current UI — merging data the
  // user has no way to review would defeat the point of this phase, so it's dropped.
  const existingWork = next.work_experiences || []
  const newWork = []
  for (const entry of employment.work_experience || []) {
    if (existingWork.length + newWork.length >= MAX_ENTRIES) break
    const company = cleanText(entry?.company)
    const position = cleanText(entry?.position)
    if (!company && !position) continue
    const candidate = {
      company: company || '',
      position: position || '',
      start_date: cleanDate(entry.start_date) || '',
      end_date: cleanDate(entry.end_date) || '',
      _highlighted: true,
    }
    const isDuplicate = [...existingWork, ...newWork].some(
      (w) => norm(w.company) === norm(candidate.company) && norm(w.position) === norm(candidate.position)
    )
    if (!isDuplicate) newWork.push(candidate)
  }
  if (newWork.length) next.work_experiences = [...existingWork, ...newWork]

  return { form: next, highlightedKeys }
}
