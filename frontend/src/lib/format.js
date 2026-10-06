const pad = (number) => String(number).padStart(2, '0')

/** Local date as 'YYYY-MM-DD' (the API's date format). Avoids toISOString(), which is UTC. */
export const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const todayIso = () => isoDate(new Date())

/** '2026-10-05' -> Date at local midnight. */
export const parseIso = (iso) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const formatDate = (iso) => (iso ? parseIso(iso).toLocaleDateString('ru-RU') : '—')

export const formatMoney = (value) =>
  value === null || value === undefined || value === ''
    ? '—'
    : `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₸`

export const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

export const currentMonth = () => monthKey(new Date())

export const shiftMonth = (key, delta) => {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(year, month - 1 + delta, 1))
}

export const monthLabel = (key) => {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export const daysUntil = (iso) => {
  const today = parseIso(todayIso())
  return Math.round((parseIso(iso) - today) / 86_400_000)
}

export const relativeDays = (iso) => {
  const days = daysUntil(iso)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

export const formatBytes = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'room', label: 'Room' },
  { value: 'house', label: 'House' },
]

export const PAYMENT_STATUS = {
  paid: { color: 'teal', label: 'Paid' },
  due: { color: 'blue', label: 'Due' },
  overdue: { color: 'red', label: 'Overdue' },
}

export const REMINDER_LEVEL = {
  overdue: { color: 'red', label: 'Overdue' },
  soon: { color: 'orange', label: 'Soon' },
  info: { color: 'blue', label: 'Heads up' },
}

/** Number inputs give numbers or ''; the API wants strings or null. */
export const toApiNumber = (value) => (value === '' || value === null || value === undefined ? null : String(value))

/** 5 -> '5th', 21 -> '21st' */
export const ordinal = (n) => {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

/** '2026-10-05' -> 'October 5th' */
export const longDate = (iso) => {
  if (!iso) return '—'
  const date = parseIso(iso)
  return `${date.toLocaleDateString('en-GB', { month: 'long' })} ${ordinal(date.getDate())}`
}

/** Whole months between two ISO dates (lease length), e.g. 01.10.2026 – 30.09.2027 -> 12 */
export const leaseMonths = (startIso, endIso) => {
  const start = parseIso(startIso)
  const end = parseIso(endIso)
  end.setDate(end.getDate() + 1)
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
}
