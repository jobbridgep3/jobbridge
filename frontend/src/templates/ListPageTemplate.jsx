import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'

import { DataTable } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { fadeIn } from '../lib/motion'
import api from '../lib/axios'

/**
 * Generic "list of records" page: fetches `endpoint`, renders a DataTable with `columns`.
 * Used across the breadth of CRUD modules so each page is a thin composition, not a
 * one-off implementation.
 */
export function ListPageTemplate({ title, description, endpoint, queryKey, columns, actions, searchPlaceholder, emptyTitle, emptyDescription, params }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKey || [endpoint, params],
    queryFn: async () => {
      const res = await api.get(endpoint, { params })
      return res.data.data
    },
  })

  return (
    <motion.div {...fadeIn}>
      <PageHeader title={title} description={description} actions={actions} />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchPlaceholder={searchPlaceholder}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    </motion.div>
  )
}
