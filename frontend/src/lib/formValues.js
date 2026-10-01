/** Initial values, validation and API conversion for the home and lease forms. */
import { toApiNumber } from './format'

export const emptyHome = {
  title: '',
  address: '',
  property_type: 'apartment',
  meter_reading_day: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  notes: '',
}

export const homeValidation = {
  title: (value) => (value.trim() ? null : 'Give the home a short name, e.g. "Flat on Abay"'),
  address: (value) => (value.trim() ? null : 'Enter the address'),
}

export const homeToApi = (values) => ({ ...values, meter_reading_day: toApiNumber(values.meter_reading_day) })

export const homeFromApi = (home) =>
  Object.fromEntries(Object.keys(emptyHome).map((key) => [key, home[key] ?? '']))

export const emptyLease = {
  start_date: '',
  end_date: '',
  monthly_rent: '',
  rent_due_day: '',
  deposit: '',
  terms: '',
}

export const leaseValidation = {
  start_date: (value) => (value ? null : 'Required'),
  end_date: (value, values) => {
    if (!value) return 'Required'
    return values.start_date && value <= values.start_date ? 'Must be after the start date' : null
  },
  monthly_rent: (value) => (Number(value) > 0 ? null : 'Enter the monthly rent'),
  rent_due_day: (value) => (value >= 1 && value <= 28 ? null : 'A day from 1 to 28'),
}

export const leaseToApi = (values) => ({
  ...values,
  monthly_rent: toApiNumber(values.monthly_rent),
  deposit: toApiNumber(values.deposit),
})

export const leaseFromApi = (lease) =>
  Object.fromEntries(
    Object.keys(emptyLease).map((key) => {
      const value = lease[key]
      if (value === null || value === undefined) return [key, '']
      return [key, ['monthly_rent', 'deposit'].includes(key) ? Number(value) : value]
    }),
  )
