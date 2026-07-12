import { BarChart3, Briefcase, Building2, CalendarPlus, Megaphone, Users, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'

const scrollTo = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary-600" /> Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to="/employer/vacancies/create"><Briefcase className="h-4 w-4" /> Post Job</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to="/employer/applicants"><Users className="h-4 w-4" /> View Applicants</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to="/employer/interviews"><CalendarPlus className="h-4 w-4" /> Schedule Interview</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to="/employer/company"><Building2 className="h-4 w-4" /> Company Profile</Link>
        </Button>
        <Button variant="secondary" size="lg" onClick={scrollTo('dashboard-analytics')}>
          <BarChart3 className="h-4 w-4" /> Reports
        </Button>
        <Button variant="secondary" size="lg" onClick={scrollTo('dashboard-announcements')}>
          <Megaphone className="h-4 w-4" /> Announcements
        </Button>
      </CardContent>
    </Card>
  )
}
