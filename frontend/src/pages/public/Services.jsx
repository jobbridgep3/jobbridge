import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { SERVICES } from '../../config/servicesContent'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function Services() {
  return (
    <motion.div {...fadeIn} className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Our Services</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          PESO Pila, Laguna offers a full range of employment-facilitation services — from the JobBridge platform's
          job matching and referral tools to the office's official government programs.
        </p>
      </div>

      <motion.div
        initial="initial"
        animate="animate"
        variants={staggerContainer}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SERVICES.map(({ icon: Icon, title, description, category }) => (
          <motion.div key={title} variants={staggerItem}>
            <Card hover className="h-full">
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant={category === 'program' ? 'primary' : 'default'}>
                    {category === 'program' ? 'PESO Program' : 'JobBridge Platform'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{title}</p>
                  <p className="mt-1 text-sm text-text-secondary">{description}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <Card>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">Ready to get started?</p>
            <p className="mt-1 text-sm text-text-muted">
              Create your account, or view the full Citizen's Charter for detailed requirements and processing time.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" asChild>
              <Link to="/citizen-charter">View Citizen's Charter</Link>
            </Button>
            <Button asChild>
              <Link to="/register/choose">Get Started</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
