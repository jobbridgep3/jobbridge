import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { fadeIn } from '../lib/motion'

/**
 * Generic create/edit form page. `fields` is a render-prop receiving RHF's
 * {register, formState, watch, setValue} so each module keeps full control of its
 * own field layout while sharing submit/cancel/loading/toast plumbing.
 */
export function FormPageTemplate({ title, description, schema, defaultValues, onSubmit, submitLabel = 'Save', cancelHref, fields }) {
  const navigate = useNavigate()
  const form = useForm({ resolver: schema ? zodResolver(schema) : undefined, defaultValues })
  const { handleSubmit, formState } = form

  const submit = async (values) => {
    try {
      await onSubmit(values)
      toast.success('Saved successfully.')
      if (cancelHref) navigate(cancelHref)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong.')
    }
  }

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-2xl">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit(submit)} className="space-y-4">
            {fields(form)}
            <div className="flex justify-end gap-2 pt-2">
              {cancelHref && (
                <Button type="button" variant="secondary" onClick={() => navigate(cancelHref)}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? 'Saving…' : submitLabel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
