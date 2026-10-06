import { formatMoney, isoDate, todayIso } from '../lib/format'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Month grid, Monday first, with the neighbouring months' days greyed out. `month` is 'YYYY-MM'. */
export default function MonthCalendar({ month, events }) {
  const [year, monthNumber] = month.split('-').map(Number)
  const first = new Date(year, monthNumber - 1, 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const cellCount = Math.ceil(((first.getDay() + 6) % 7 + daysInMonth) / 7) * 7
  const today = todayIso()

  const byDate = events.reduce((groups, event) => {
    ;(groups[event.date] ??= []).push(event)
    return groups
  }, {})

  const cells = Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { iso: isoDate(date), day: date.getDate(), outside: date.getMonth() !== monthNumber - 1 }
  })

  return (
    <div className="mr-cal">
      <div className="mr-cal-grid">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="mr-cal-head">{weekday}</div>
        ))}
        {cells.map((cell) => (
          <div key={cell.iso} className="mr-cal-day" data-outside={cell.outside || undefined}
            data-today={cell.iso === today || undefined}>
            <span className="mr-cal-num">{cell.day}</span>
            {!cell.outside && (byDate[cell.iso] ?? []).map((event) => (
              <span
                key={`${event.kind}-${event.object_id ?? event.property_id}`}
                className="mr-cal-event"
                data-kind={event.kind}
                data-status={event.status || undefined}
                title={`${event.title}${event.amount ? ` · ${formatMoney(event.amount)}` : ''}`}
              >
                {event.title}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
