import { Group, Stack, Text } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { useCalendar, useDashboard } from '../api/queries'
import MonthCalendar from '../components/MonthCalendar'
import { Panel, Tile } from '../components/ui'
import { currentMonth, formatDate, formatMoney, monthLabel, relativeDays, shiftMonth } from '../lib/format'

const LEGEND = [
  { label: 'Due', style: { background: 'var(--mr-dark)' } },
  { label: 'Paid', style: { background: 'var(--mr-muted)' } },
  { label: 'Overdue', style: { background: 'var(--mr-danger)' } },
  { label: 'Meter readings', style: { background: 'var(--mr-dark-2)' } },
  { label: 'Lease ends', style: { background: '#c9a46a' } },
]

export default function CalendarPage() {
  const { homeId } = useParams()
  const [month, setMonth] = useState(currentMonth)
  const calendar = useCalendar(homeId, month)
  const dashboard = useDashboard(homeId)
  const reminders = dashboard.data?.reminders ?? []
  const [next, ...rest] = reminders

  return (
    <div className="mr-split">
      <Panel
        title="Calendar"
        actions={
          <div className="mr-month-pill">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
              <IconChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setMonth(currentMonth())} style={{ width: 'auto', padding: '0 4px', borderRadius: 8 }}
              aria-label="Back to this month">
              {monthLabel(month)}
            </button>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
              <IconChevronRight size={16} />
            </button>
          </div>
        }
      >
        <MonthCalendar month={month} events={calendar.data ?? []} />
        <Group gap="md" mt="sm">
          {LEGEND.map(({ label, style }) => (
            <Group key={label} gap={6}>
              <span style={{ ...style, width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }} />
              <Text size="xs" c="dimmed">{label}</Text>
            </Group>
          ))}
        </Group>
      </Panel>

      <div className="mr-side">
        {next ? (
          <Tile tone="dark" label="Next reminder" value={formatDate(next.date)}>
            <Text fw={600} mt={4} c="var(--mr-bg)">{next.title}</Text>
            <Text size="sm" c="#eadfdc">
              {next.amount ? `${formatMoney(next.amount)} · ` : ''}{relativeDays(next.date)}
            </Text>
          </Tile>
        ) : (
          <Tile tone="dark" label="Next reminder" value="All clear">
            <Text size="sm" mt={4} c="#eadfdc">
              Reminders appear by themselves from your lease, bills and meter-reading day.
            </Text>
          </Tile>
        )}
        {rest.length > 0 && (
          <Stack gap={10}>
            {rest.map((reminder) => (
              <Tile key={reminder.key} label={formatDate(reminder.date)} value={reminder.title}
                sub={reminder.amount ? formatMoney(reminder.amount) : undefined} />
            ))}
          </Stack>
        )}
      </div>
    </div>
  )
}
