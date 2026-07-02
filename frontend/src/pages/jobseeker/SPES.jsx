import { ProgramApplicationPage } from './ProgramApplicationPage'

export default function JobseekerSPES() {
  return (
    <ProgramApplicationPage
      programType="spes"
      title="SPES"
      description="Special Program for Employment of Students. Apply and track your status here."
      formFields={[
        { name: 'school', label: 'School / University' },
        { name: 'course', label: 'Course' },
        { name: 'year_level', label: 'Year Level' },
        { name: 'parent_income', label: 'Parent/Guardian Monthly Income' },
        { name: 'preferred_work_assignment', label: 'Preferred Work Assignment', wide: true, type: 'textarea' },
      ]}
    />
  )
}
