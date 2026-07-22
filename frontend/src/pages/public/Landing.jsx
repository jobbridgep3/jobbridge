import { AnnouncementsPanel } from './home/AnnouncementsPanel'
import { FindJobsPanel } from './home/FindJobsPanel'
import { HeroSection } from './home/HeroSection'
import { JobFairPanel } from './home/JobFairPanel'
import { QuickLinksStrip } from './home/QuickLinksStrip'
import { StatsBar } from './home/StatsBar'
import { useHomepageLiveUpdates } from './home/useHomepageLiveUpdates'

export default function Landing() {
  useHomepageLiveUpdates()

  return (
    <div>
      <HeroSection />
      <StatsBar />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <FindJobsPanel />
          <JobFairPanel />
          <AnnouncementsPanel />
        </div>
      </section>

      <QuickLinksStrip />
    </div>
  )
}
