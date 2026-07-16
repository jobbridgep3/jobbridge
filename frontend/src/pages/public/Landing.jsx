import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Briefcase, FileSearch, QrCode, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import logo from '../../assets/peso-logo.png'
import { AnnouncementCard } from '../../components/announcements/AnnouncementCard'
import { AnnouncementCarousel } from '../../components/announcements/AnnouncementCarousel'
import { Button } from '../../components/ui/Button'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

const FEATURES = [
  { icon: FileSearch, title: 'AI Job Matching', description: 'TF-IDF & Cosine Similarity match your skills to the right vacancies.' },
  { icon: Briefcase, title: 'Full Application Tracking', description: 'From application to employment monitoring, all in one place.' },
  { icon: QrCode, title: 'QR Job Fair Attendance', description: 'Register for PESO job fairs and check in instantly with a QR code.' },
  { icon: ShieldCheck, title: 'Government-Grade Reporting', description: 'Automated LMI reports for DOLE, generated and exported on demand.' },
]

export default function Landing() {
  const { data: announcements } = useQuery({
    queryKey: ['announcements', 'public'],
    queryFn: async () => (await api.get('/api/announcements/public')).data.data,
  })
  const pinned = (announcements || []).filter((a) => a.is_pinned).slice(0, 5)
  const latest = (announcements || []).slice(0, 6)

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="JobBridge" className="h-8 w-8" />
            <span className="text-lg font-semibold text-primary-900 dark:text-primary-300">JobBridge</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link to="/register/choose">Register</Link>
            </Button>
          </div>
        </div>
      </header>

      <motion.section {...fadeIn} className="mx-auto max-w-4xl px-6 py-20 text-center">
        <span className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
          Public Employment Service Office — Pila, Laguna
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
          Intelligent Job Matching & Employment Monitoring
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
          JobBridge connects jobseekers, employers, and PESO Pila through AI-powered matching,
          OCR-assisted profiles, and a fully digital employment facilitation process.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/register">Register as Jobseeker</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/register?type=employer">Register as Employer</Link>
          </Button>
        </div>
      </motion.section>

      {pinned.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <AnnouncementCarousel announcements={pinned} />
        </section>
      )}

      {latest.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Latest Announcements</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} />
            ))}
          </div>
        </section>
      )}

      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.3 }}
        className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4"
      >
        {FEATURES.map((f) => (
          <motion.div key={f.title} variants={staggerItem} className="rounded-xl border border-border p-6">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">{f.title}</h3>
            <p className="mt-1 text-sm text-text-muted">{f.description}</p>
          </motion.div>
        ))}
      </motion.section>

      <footer className="border-t border-border py-8 text-center text-xs text-text-muted">
        JobBridge — PESO Pila, Laguna | Laguna State Polytechnic University, BSIT
      </footer>
    </div>
  )
}
