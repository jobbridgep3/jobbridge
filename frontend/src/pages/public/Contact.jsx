import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Clock, Mail, MapPin, Phone, Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { FormError, Input, Label, Textarea } from '../../components/ui/Input'
import { SITE_INFO } from '../../config/siteInfo'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

const schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email address'),
  subject: z.string().max(150).optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  website: z.string().max(0).optional(), // honeypot — must stay empty
})

const mapQuery = encodeURIComponent(SITE_INFO.address)
const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`

export default function Contact() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    try {
      const res = await api.post('/api/contact', values)
      toast.success(res.data?.message || 'Message sent. We will get back to you soon.')
      reset()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send your message. Please try again.')
    }
  }

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Contact Us</h1>
        <p className="mt-1 text-sm text-text-muted">
          Have a question about a job, referral, or program? Reach out and PESO Pila will get back to you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-700 dark:text-primary-400" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Office Address</p>
                  <p className="text-sm text-text-secondary">{SITE_INFO.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary-700 dark:text-primary-400" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Phone</p>
                  <p className="text-sm text-text-secondary">Telefax: {SITE_INFO.telefax}</p>
                  <p className="text-sm text-text-secondary">Mobile: {SITE_INFO.mobile}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary-700 dark:text-primary-400" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Email</p>
                  <a href={`mailto:${SITE_INFO.contactEmail}`} className="text-sm text-primary-700 hover:underline dark:text-primary-400">
                    {SITE_INFO.contactEmail}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary-700 dark:text-primary-400" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Office Hours</p>
                  <p className="text-sm text-text-secondary">{SITE_INFO.officeHours}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-col items-center gap-2 bg-surface-secondary p-8 text-center">
              <MapPin className="h-6 w-6 text-text-muted" />
              <p className="text-sm text-text-secondary">{SITE_INFO.address}</p>
              <a href={mapSearchUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-400">
                View on Google Maps →
              </a>
            </div>
          </Card>
        </div>

        <Card className="lg:col-span-3">
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-text-primary">Send Us a Message</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Honeypot: hidden from real visitors via CSS, only bots fill it in. */}
              <div className="hidden" aria-hidden="true">
                <Label htmlFor="website">Website</Label>
                <Input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="Juan Dela Cruz" {...register('name')} />
                  <FormError>{errors.name?.message}</FormError>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
                  <FormError>{errors.email?.message}</FormError>
                </div>
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" placeholder="e.g. Question about SPES eligibility" {...register('subject')} />
                <FormError>{errors.subject?.message}</FormError>
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" rows={5} placeholder="How can we help you?" {...register('message')} />
                <FormError>{errors.message?.message}</FormError>
              </div>

              <Button type="submit" disabled={isSubmitting}>
                <Send className="h-4 w-4" /> {isSubmitting ? 'Sending…' : 'Send Message'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
