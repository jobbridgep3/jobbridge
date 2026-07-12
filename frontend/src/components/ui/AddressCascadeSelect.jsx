import { useQuery } from '@tanstack/react-query'

import api from '../../lib/axios'
import { cn } from '../../lib/utils'
import { Input, Label, Select } from './Input'

/** Region -> Province -> City/Municipality -> Barangay cascading picker, backed by
 * the read-only /api/lookups/psgc/* endpoints (services/psgc_service.py). Each level
 * loads once and is cached indefinitely (staleTime: Infinity) since PSGC codes don't
 * change during a session. Shared by Company Address, HR Profile Address, and
 * Vacancy Location — one component, one set of network calls, one value shape:
 *
 * { region_code, region_name, province_code, province_name, city_municipality_code,
 *   city_municipality_name, barangay_code, barangay_name, street_address, zip_code }
 *
 * `value`/`onChange` follow the standard controlled-component contract so this drops
 * straight into any react-hook-form field via Controller, same as any other input. */
export function AddressCascadeSelect({ value = {}, onChange, disabled, missingKeys = new Set() }) {
  const err = (key) => cn(missingKeys.has(key) && 'border-red-300 focus:border-red-400')
  const regionsQuery = useQuery({
    queryKey: ['lookups', 'psgc', 'regions'],
    queryFn: async () => (await api.get('/api/lookups/psgc/regions')).data.data,
    staleTime: Infinity,
  })
  const provincesQuery = useQuery({
    queryKey: ['lookups', 'psgc', 'provinces', value.region_code],
    queryFn: async () => (await api.get('/api/lookups/psgc/provinces', { params: { region_code: value.region_code } })).data.data,
    enabled: Boolean(value.region_code),
    staleTime: Infinity,
  })
  const citiesQuery = useQuery({
    queryKey: ['lookups', 'psgc', 'cities', value.province_code],
    queryFn: async () => (await api.get('/api/lookups/psgc/cities', { params: { province_code: value.province_code } })).data.data,
    enabled: Boolean(value.province_code),
    staleTime: Infinity,
  })
  const barangaysQuery = useQuery({
    queryKey: ['lookups', 'psgc', 'barangays', value.city_municipality_code],
    queryFn: async () => (await api.get('/api/lookups/psgc/barangays', { params: { city_municipality_code: value.city_municipality_code } })).data.data,
    enabled: Boolean(value.city_municipality_code),
    staleTime: Infinity,
  })

  const set = (patch) => onChange({ ...value, ...patch })

  const onRegionChange = (e) => {
    const region = (regionsQuery.data || []).find((r) => r.region_code === e.target.value)
    set({
      region_code: region?.region_code || '', region_name: region?.region_name || '',
      province_code: '', province_name: '', city_municipality_code: '', city_municipality_name: '',
      barangay_code: '', barangay_name: '',
    })
  }

  const onProvinceChange = (e) => {
    const province = (provincesQuery.data || []).find((p) => p.province_code === e.target.value)
    set({
      province_code: province?.province_code || '', province_name: province?.province_name || '',
      city_municipality_code: '', city_municipality_name: '', barangay_code: '', barangay_name: '',
    })
  }

  const onCityChange = (e) => {
    const city = (citiesQuery.data || []).find((c) => c.city_municipality_code === e.target.value)
    set({
      city_municipality_code: city?.city_municipality_code || '', city_municipality_name: city?.city_municipality_name || '',
      barangay_code: '', barangay_name: '',
    })
  }

  const onBarangayChange = (e) => {
    const barangay = (barangaysQuery.data || []).find((b) => b.barangay_code === e.target.value)
    set({ barangay_code: barangay?.barangay_code || '', barangay_name: barangay?.barangay_name || '' })
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label>Region</Label>
        <Select value={value.region_code || ''} onChange={onRegionChange} disabled={disabled || regionsQuery.isLoading} className={err('region_code')}>
          <option value="">Select region…</option>
          {(regionsQuery.data || []).map((r) => (
            <option key={r.region_code} value={r.region_code}>{r.region_name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Province</Label>
        <Select value={value.province_code || ''} onChange={onProvinceChange} disabled={disabled || !value.region_code || provincesQuery.isLoading} className={err('province_code')}>
          <option value="">Select province…</option>
          {(provincesQuery.data || []).map((p) => (
            <option key={p.province_code} value={p.province_code}>{p.province_name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>City / Municipality</Label>
        <Select value={value.city_municipality_code || ''} onChange={onCityChange} disabled={disabled || !value.province_code || citiesQuery.isLoading} className={err('city_municipality_code')}>
          <option value="">Select city/municipality…</option>
          {(citiesQuery.data || []).map((c) => (
            <option key={c.city_municipality_code} value={c.city_municipality_code}>{c.city_municipality_name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Barangay</Label>
        <Select value={value.barangay_code || ''} onChange={onBarangayChange} disabled={disabled || !value.city_municipality_code || barangaysQuery.isLoading} className={err('barangay_code')}>
          <option value="">Select barangay…</option>
          {(barangaysQuery.data || []).map((b) => (
            <option key={b.barangay_code} value={b.barangay_code}>{b.barangay_name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Street Address</Label>
        <Input
          value={value.street_address || ''}
          onChange={(e) => set({ street_address: e.target.value })}
          placeholder="House/unit no., building, street"
          disabled={disabled}
          className={err('street_address')}
        />
      </div>
      <div>
        <Label>ZIP Code</Label>
        <Input value={value.zip_code || ''} onChange={(e) => set({ zip_code: e.target.value })} placeholder="e.g. 1000" disabled={disabled} />
      </div>
    </div>
  )
}
