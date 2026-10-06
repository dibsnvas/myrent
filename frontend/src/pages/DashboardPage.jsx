import { ActionIcon, Anchor, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconPencil, IconPlus, IconSettings } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { useDashboard } from '../api/queries'
import { QueryState } from '../components/common'
import { EditHomeModal, LeaseModal } from '../components/modals'
import { Panel, StatusPill, Tile } from '../components/ui'
import { formatDate, formatMoney, longDate, relativeDays } from '../lib/format'

function UpcomingTile({ base, upcoming, reminders }) {
  const other = reminders.filter((reminder) => !reminder.key.startsWith('payment:'))
  return (
    <Tile label="Upcoming payments" to={`${base}/calendar`} className="mr-dash-wide">
      <Stack gap={8} mt="sm">
        {upcoming.length === 0 && other.length === 0 && (
          <Text size="sm" c="dimmed">Nothing due. Add your lease or bills to see what is coming.</Text>
        )}
        {upcoming.map((payment) => (
          <Group key={payment.id} justify="space-between" wrap="nowrap" gap="xs">
            <div style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>{payment.display_title}</Text>
              <Text size="xs" c="dimmed">{formatDate(payment.due_date)} · {relativeDays(payment.due_date)}</Text>
            </div>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={600}>{formatMoney(payment.amount)}</Text>
              <StatusPill status={payment.status} />
            </Group>
          </Group>
        ))}
        {other.map((reminder) => (
          <Group key={reminder.key} justify="space-between" wrap="nowrap" gap="xs">
            <Text size="sm" fw={600} c={reminder.level === 'overdue' ? 'var(--mr-danger)' : undefined}>
              {reminder.title}
            </Text>
            <Text size="xs" c="dimmed">{formatDate(reminder.date)}</Text>
          </Group>
        ))}
      </Stack>
    </Tile>
  )
}

function PhotoTile({ base, photos }) {
  const [index, setIndex] = useState(0)
  const photo = photos[index]
  return (
    <Tile label="Move-in photos" value={photo ? photo.room : undefined} to={`${base}/condition`}>
      {photo ? (
        <>
          <a href={photo.url} target="_blank" rel="noreferrer">
            <img src={photo.url} alt={`${photo.room} ${photo.item}`}
              style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 14, marginTop: 10, display: 'block' }} />
          </a>
          <Group justify="center" gap={6} mt={8}>
            {photos.map((item, dot) => (
              <button key={item.id} type="button" aria-label={`Photo ${dot + 1}`} onClick={() => setIndex(dot)}
                style={{ width: 7, height: 7, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                  background: dot === index ? 'var(--mr-dark)' : 'var(--mr-muted)' }} />
            ))}
          </Group>
        </>
      ) : (
        <Text size="sm" c="dimmed" mt="sm">No photos yet. Photograph every room at move-in.</Text>
      )}
    </Tile>
  )
}

export default function DashboardPage() {
  const { homeId } = useParams()
  const dashboard = useDashboard(homeId)
  const [modal, setModal] = useState(null) // 'home' | 'lease'
  const close = () => setModal(null)
  const base = `/homes/${homeId}`

  return (
    <QueryState query={dashboard}>
      {(data) => {
        const home = data.property
        const lease = home.active_contract
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(home.address)}`
        return (
          <Panel>
            {!lease && (
              <Group justify="space-between" mb="md" p="md" style={{ background: 'var(--mr-bg)', borderRadius: 20 }}>
                <Text size="sm">Add your lease dates and rent: MyRent then builds your payment schedule and reminders.</Text>
                <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModal('lease')}>Add lease</Button>
              </Group>
            )}
            <div className="mr-dash">
              <Tile label="Apartment location" value={home.address} sub={home.title} tone="dark"
                to={`${base}/contract`} className="mr-dash-location">
                <div className="mr-map" />
                <Anchor href={mapUrl} target="_blank" rel="noreferrer" size="xs" c="var(--mr-bg)" mt={6} display="inline-block">
                  Open on the map
                </Anchor>
              </Tile>
              <Tile label="Monthly payment date" value={data.next_rent ? longDate(data.next_rent.due_date) : '—'}
                sub={data.next_rent ? relativeDays(data.next_rent.due_date) : 'No upcoming rent'} to={`${base}/payments`} />
              <Tile label="Payment date for utilities"
                value={data.next_utility_bill ? longDate(data.next_utility_bill.due_date) : '—'}
                sub={data.next_utility_bill ? data.next_utility_bill.display_title : 'No unpaid bills'}
                to={`${base}/utilities`} />
              <div className="mr-dash-tools">
                <Tooltip label="Edit home and landlord">
                  <ActionIcon variant="outline" color="rose.7" radius="xl" size="lg" onClick={() => setModal('home')}
                    aria-label="Edit home and landlord">
                    <IconSettings size={18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={lease ? 'Edit lease' : 'Add lease'}>
                  <ActionIcon variant="outline" color="rose.7" radius="xl" size="lg" onClick={() => setModal('lease')}
                    aria-label={lease ? 'Edit lease' : 'Add lease'}>
                    <IconPencil size={18} />
                  </ActionIcon>
                </Tooltip>
              </div>
              <Tile label="Monthly payment amount" value={lease ? formatMoney(lease.monthly_rent) : '—'}
                sub={data.overdue.count ? `${formatMoney(data.overdue.total)} overdue` : 'Nothing overdue'}
                to={`${base}/contract`} />
              <Tile label="Average utility bill"
                value={data.average_utility_bill ? formatMoney(data.average_utility_bill) : '—'}
                sub="per month, last 3 months" to={`${base}/utilities`} />
              <UpcomingTile base={base} upcoming={data.upcoming} reminders={data.reminders} />
              <PhotoTile base={base} photos={data.recent_photos} />
            </div>
            {modal === 'home' && <EditHomeModal home={home} opened onClose={close} />}
            {modal === 'lease' && <LeaseModal homeId={home.id} lease={lease} opened onClose={close} />}
          </Panel>
        )
      }}
    </QueryState>
  )
}
