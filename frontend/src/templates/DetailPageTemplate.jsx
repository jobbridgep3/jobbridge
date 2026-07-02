import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'

import { CardSkeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { fadeIn } from '../lib/motion'
import api from '../lib/axios'

export function DetailPageTemplate({ title, description, endpointFn, queryKey, actions, children }) {
  const params = useParams()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKey || [endpointFn(params), params],
    queryFn: async () => {
      const res = await api.get(endpointFn(params))
      return res.data.data
    },
  })

  return (
    <motion.div {...fadeIn}>
      <PageHeader title={title} description={description} actions={actions} />
      {isLoading ? (
        <CardSkeleton />
      ) : error || !data ? (
        <EmptyState title="Record not found" description="It may have been removed or you no longer have access." />
      ) : (
        children(data)
      )}
    </motion.div>
  )
}
