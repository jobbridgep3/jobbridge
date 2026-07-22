import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import heroPhoto from '../../../assets/pila-municipal-center.jpg'
import { Button } from '../../../components/ui/Button'
import { fadeIn } from '../../../lib/motion'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroPhoto} alt="Pila Municipal Center" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-slate-950/30" />
      </div>

      <motion.div {...fadeIn} className="relative mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
        <span className="mb-4 inline-block rounded-full bg-primary-600/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Public Employment Service Office — Pila, Laguna
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Bridging Opportunities.
          <br />
          Building Futures.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
          JobBridge PESO Pila connects jobseekers and employers through intelligent matching,
          digital solutions, and meaningful opportunities.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link to="/register">I&apos;m a Jobseeker</Link>
          </Button>
          <Button size="lg" variant="secondary" className="bg-white/95 hover:bg-white" asChild>
            <Link to="/register?type=employer">I&apos;m an Employer</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  )
}
