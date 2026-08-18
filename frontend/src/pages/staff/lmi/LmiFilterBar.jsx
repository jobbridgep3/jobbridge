import { useQuery } from '@tanstack/react-query'
import { Filter, X } from 'lucide-react'

import { Button } from '../../../components/ui/Button'
import { Card, CardContent } from '../../../components/ui/Card'
import { DatePicker } from '../../../components/ui/DatePicker'
import { Input, Label, Select } from '../../../components/ui/Input'
import api from '../../../lib/axios'
import { AGE_GROUPS, ATTAINMENT_LEVELS, EMPLOYMENT_STATUSES, EMPTY_LMI_FILTERS, GENDERS, PERIOD_OPTIONS, VACANCY_STATUSES } from './lmiFilters'

/** Shared filter bar for the whole LMI page — every KPI/chart/table/export
 * reads from this same lifted `filters` state, so nothing on the page can
 * ever disagree about which filters are active. */
export function LmiFilterBar({ filters, setFilters }) {
  const { data: options } = useQuery({
    queryKey: ['lmi', 'filter-options'],
    queryFn: async () => (await api.get('/api/staff/lmi/filter-options')).data.data,
    staleTime: 5 * 60_000,
  })

  const set = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }))
  const setValue = (field) => (value) => setFilters((f) => ({ ...f, [field]: value }))

  const setAgeGroup = (e) => {
    const group = AGE_GROUPS.find((g) => g.label === e.target.value)
    setFilters((f) => ({ ...f, age_min: group ? String(group.min) : '', age_max: group?.max != null ? String(group.max) : '' }))
  }
  const currentAgeGroup = AGE_GROUPS.find((g) => String(g.min) === filters.age_min && String(g.max ?? '') === (filters.age_max || ''))?.label || ''

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
            <Filter className="h-4 w-4" /> Filters
          </div>
          <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_LMI_FILTERS)}>
            <X className="h-3.5 w-3.5" /> Clear Filters
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Reporting Period</Label>
            <Select value={filters.period} onChange={set('period')}>
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>
          {filters.period === 'custom' && (
            <>
              <div>
                <Label>Date From</Label>
                <DatePicker value={filters.date_from} onChange={setValue('date_from')} maxDate={filters.date_to} />
              </div>
              <div>
                <Label>Date To</Label>
                <DatePicker value={filters.date_to} onChange={setValue('date_to')} minDate={filters.date_from} />
              </div>
            </>
          )}
          <div>
            <Label>Barangay</Label>
            <Select value={filters.barangay} onChange={set('barangay')}>
              <option value="">All Barangays</option>
              {(options?.barangays || []).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Municipality</Label>
            <Select value={filters.municipality} onChange={set('municipality')}>
              <option value="">All Municipalities</option>
              {(options?.municipalities || []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Gender</Label>
            <Select value={filters.gender} onChange={set('gender')}>
              <option value="">All Genders</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Age Group</Label>
            <Select value={currentAgeGroup} onChange={setAgeGroup}>
              <option value="">All Ages</option>
              {AGE_GROUPS.map((g) => (
                <option key={g.label} value={g.label}>{g.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Employment Status</Label>
            <Select value={filters.employment_status} onChange={set('employment_status')}>
              <option value="">All Statuses</option>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Educational Attainment</Label>
            <Select value={filters.educational_attainment} onChange={set('educational_attainment')}>
              <option value="">All Levels</option>
              {ATTAINMENT_LEVELS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Industry</Label>
            <Select value={filters.industry} onChange={set('industry')}>
              <option value="">All Industries</option>
              {(options?.industries || []).map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Occupation</Label>
            <Input placeholder="Search job title…" value={filters.occupation} onChange={set('occupation')} />
          </div>
          <div>
            <Label>Job Category</Label>
            <Select value={filters.job_category_id} onChange={set('job_category_id')}>
              <option value="">All Categories</option>
              {(options?.job_categories || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Employer</Label>
            <Select value={filters.employer_company_id} onChange={set('employer_company_id')}>
              <option value="">All Employers</option>
              {(options?.employers || []).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Vacancy Status</Label>
            <Select value={filters.vacancy_status} onChange={set('vacancy_status')}>
              <option value="">All Statuses</option>
              {VACANCY_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
              ))}
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
