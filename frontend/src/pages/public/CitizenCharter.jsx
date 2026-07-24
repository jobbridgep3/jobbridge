import { motion } from 'framer-motion'
import { Download, ExternalLink, FileText } from 'lucide-react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { openCitizenCharter, SITE_INFO } from '../../config/siteInfo'
import { fadeIn } from '../../lib/motion'

export default function CitizenCharter() {
  return (
    <motion.div {...fadeIn} className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Citizen's Charter</h1>
        <p className="mt-1 text-sm text-text-muted">
          {SITE_INFO.officeName}'s official Citizen's Charter — our commitment to you, including the requirements,
          steps, fees, and processing time for every external service we offer.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={SITE_INFO.citizenCharterUrl} download>
            <Download className="h-4 w-4" /> Download PDF
          </a>
        </Button>
        <Button variant="secondary" size="sm" onClick={openCitizenCharter}>
          <ExternalLink className="h-4 w-4" /> Open in New Tab
        </Button>
      </div>

      <Card className="overflow-hidden">
        <iframe
          src={SITE_INFO.citizenCharterUrl}
          title="PESO Citizen's Charter"
          className="h-[80vh] w-full"
        >
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <FileText className="h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-secondary">
              Your browser can't display the PDF inline. Use the buttons above to download or open it instead.
            </p>
          </div>
        </iframe>
      </Card>
    </motion.div>
  )
}
