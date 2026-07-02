import { ProgramApplicationPage } from './ProgramApplicationPage'

export default function JobseekerOWWA() {
  return (
    <ProgramApplicationPage
      programType="owwa"
      title="OWWA"
      description="OWWA Assistance Module for OFWs and returning workers."
      formFields={[
        { name: 'owwa_membership_number', label: 'OWWA Membership Number' },
        { name: 'assistance_type', label: 'Type of Assistance Requested' },
        { name: 'supporting_details', label: 'Supporting Details', wide: true, type: 'textarea' },
      ]}
    />
  )
}
