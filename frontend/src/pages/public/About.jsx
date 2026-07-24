import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import logo from '../../assets/peso-logo.png'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { ABOUT_IMAGES, GOAL, MISSION, VISION } from '../../config/aboutContent'
import { SITE_INFO } from '../../config/siteInfo'
import { fadeIn } from '../../lib/motion'

const SECTIONS = [
  { label: 'Goal', text: GOAL, imageKey: 'goal' },
  { label: 'Mission', text: MISSION, imageKey: 'mission' },
  { label: 'Vision', text: VISION, imageKey: 'vision' },
]

export default function About() {
  return (
    <motion.div {...fadeIn} className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface-secondary p-8 text-center">
        <img src={ABOUT_IMAGES.hero || logo} alt={SITE_INFO.officeName} className="h-20 w-20" />
        <div>
          <h1 className="text-xl font-semibold text-text-primary">About {SITE_INFO.officeName}</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            The Public Employment Service Office (PESO) of Pila, Laguna connects jobseekers with employment
            opportunities, helps employers find qualified candidates, and delivers government livelihood and
            training programs to the community.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <Card key={section.label} className="h-full">
            <CardContent className="flex h-full flex-col gap-3">
              {ABOUT_IMAGES[section.imageKey] && (
                <img src={ABOUT_IMAGES[section.imageKey]} alt={section.label} className="w-full rounded-lg object-cover" />
              )}
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-400">
                P.E.S.O. {section.label}
              </p>
              <p className="text-sm text-text-secondary">{section.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">Want to know more or visit us?</p>
            <p className="mt-1 text-sm text-text-muted">Get our office address, contact details, and office hours.</p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/contact">Contact Us</Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
