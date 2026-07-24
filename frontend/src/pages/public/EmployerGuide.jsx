import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EMPLOYER_GUIDE_STEPS } from '../../config/guidesContent'
import { fadeIn } from '../../lib/motion'

export default function EmployerGuide() {
  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Employer Guide</h1>
        <p className="mt-1 text-sm text-text-muted">
          A step-by-step walkthrough of how to post vacancies and hire through JobBridge.
        </p>
      </div>

      <div className="space-y-3">
        {EMPLOYER_GUIDE_STEPS.map(({ step, icon: Icon, title, description }) => (
          <Card key={step}>
            <CardContent className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-800 dark:bg-primary-900/40 dark:text-primary-300">
                {step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary-700 dark:text-primary-400" />
                  <p className="text-sm font-semibold text-text-primary">{title}</p>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button asChild size="lg">
          <Link to="/register/choose">Get Started as an Employer</Link>
        </Button>
      </div>
    </motion.div>
  )
}
