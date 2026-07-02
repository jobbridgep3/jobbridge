import { ProgramApplicationPage } from './ProgramApplicationPage'

export default function JobseekerDILP() {
  return (
    <ProgramApplicationPage
      programType="dilp"
      title="DILP"
      description="DOLE Integrated Livelihood Program. Apply for livelihood assistance here."
      formFields={[
        { name: 'proposed_project', label: 'Proposed Livelihood Project', wide: true, type: 'textarea' },
        { name: 'estimated_cost', label: 'Estimated Cost' },
        { name: 'barangay', label: 'Barangay' },
      ]}
    />
  )
}
