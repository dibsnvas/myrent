import { Group, Text } from '@mantine/core'

import { useCopy } from '../auth/useCopy'
import { formatMoney, isoDate, todayIso } from '../lib/format'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function eventStyle(event) {
  if (event.kind === 'meter_reading') return { background: 'var(--mantine-color-violet-1)', color: 'var(--mantine-color-violet-9)' }
  if (event.kind === 'contract_end') return { background: 'var(--mantine-color-orange-1)', color: 'var(--mantine-color-orange-9)' }
  const palette = { paid: 'teal', overdue: 'red', due: 'blue' }[event.status] ?? 'gray'
  return { background: `var(--mantine-color-${palette}-1)`, color: `var(--mantine-color-${palette}-9)` }
}

const legend = (labels) => [
  { label: labels.due, style: eventStyle({ kind: 'payment', status: 'due' }) },
  { label: labels.paid, style: eventStyle({ kind: 'payment', status: 'paid' }) },
  { label: labels.overdue, style: eventStyle({ kind: 'payment', status: 'overdue' }) },
  { label: 'Meter readings', style: eventStyle({ kind: 'meter_reading' }) },
  { label: 'Lease ends', style: eventStyle({ kind: 'contract_end' }) },
]

/** Month grid, Monday first. `month` is 'YYYY-MM'; events come from /api/calendar/. */
export default function MonthCalendar({ month, events }) {
  const copy = useCopy()
  const [year, monthNumber] = month.split('-').map(Number)
  const first = new Date(year, monthNumber - 1, 1)
  const leadingBlanks = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const today = todayIso()

  const byDate = events.reduce((groups, event) => {
    ;(groups[event.date] ??= []).push(event)
    return groups
  }, {})

  const cells = [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ key: `blank-${index}` })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const iso = isoDate(new Date(year, monthNumber - 1, index + 1))
      return { key: iso, iso, day: index + 1 }
    }),
  ]

  return (
    <div>
      <div className="calendar-grid" style={{ marginBottom: 4 }}>
        {WEEKDAYS.map((weekday) => (
          <Text key={weekday} size="xs" c="dimmed" ta="center" fw={600}>
            {weekday}
          </Text>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((cell) =>
          cell.iso ? (
            <div key={cell.key} className="calendar-day" data-today={cell.iso === today || undefined}>
              <Text size="xs" fw={cell.iso === today ? 700 : 500}>
                {cell.day}
              </Text>
              {(byDate[cell.iso] ?? []).map((event) => (
                <span
                  key={`${event.kind}-${event.object_id ?? event.property_id}`}
                  className="calendar-event"
                  style={eventStyle(event)}
                  title={`${event.title}${event.amount ? ` · ${formatMoney(event.amount)}` : ''}`}
                >
                  {event.title}
                </span>
              ))}
            </div>
          ) : (
            <div key={cell.key} className="calendar-day" data-outside />
          ),
        )}
      </div>
      <Group gap="md" mt="sm">
        {legend(copy.statusLabels).map(({ label, style }) => (
          <Group key={label} gap={6}>
            <span style={{ ...style, width: 10, height: 10, borderRadius: 3, display: 'inline-block' }} />
            <Text size="xs" c="dimmed">
              {label}
            </Text>
          </Group>
        ))}
      </Group>
    </div>
  )
}
