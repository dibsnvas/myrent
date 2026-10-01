import { Anchor, Badge, Button, Card, Group, Progress, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import {
  IconBolt,
  IconCalendarDue,
  IconFileText,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useDashboard } from '../api/queries'
import { useCopy } from '../auth/useCopy'
import { EmptyState, PageHeader, QueryState, ReminderList } from '../components/common'
import { EditHomeModal, LeaseModal, RenewModal } from '../components/modals'
import { formatDate, formatMoney, relativeDays } from '../lib/format'

function StatCard({ label, value, hint, color }) {
  return (
    <Card withBorder padding="lg">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text fz={26} fw={700} c={color} mt={4}>
        {value}
      </Text>
      {hint}
    </Card>
  )
}

function LeaseCard({ homeId, lease, onAdd, onEdit, onRenew }) {
  if (!lease) {
    return (
      <Card withBorder padding="lg">
        <EmptyState
          icon={IconFileText}
          title="No lease yet"
          text="Add the lease dates and rent to get a payment calendar and reminders."
          action={<Button leftSection={<IconPlus size={16} />} onClick={onAdd}>Add lease</Button>}
        />
      </Card>
    )
  }
  const rows = [
    ['Period', `${formatDate(lease.start_date)} – ${formatDate(lease.end_date)}`],
    ['Monthly rent', formatMoney(lease.monthly_rent)],
    ['Rent due', `Day ${lease.rent_due_day} of each month`],
    ['Deposit', formatMoney(lease.deposit)],
  ]
  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Title order={4}>Lease</Title>
          {lease.is_expired && <Badge color="red" variant="light">Ended</Badge>}
          {lease.previous && <Badge variant="light">Renewal</Badge>}
        </Group>
        <Group gap="xs">
          <Button size="xs" variant="default" leftSection={<IconPencil size={14} />} onClick={onEdit}>
            Edit
          </Button>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={onRenew}>
            Renew
          </Button>
        </Group>
      </Group>
      <Stack gap={6}>
        {rows.map(([label, value]) => (
          <Group key={label} justify="space-between" gap="xs">
            <Text size="sm" c="dimmed">{label}</Text>
            <Text size="sm" fw={500}>{value}</Text>
          </Group>
        ))}
        {lease.terms && (
          <Text size="sm" mt="xs" style={{ whiteSpace: 'pre-line' }}>
            {lease.terms}
          </Text>
        )}
        <Group justify="space-between" mt="xs">
          {lease.document_file ? (
            <Anchor href={lease.document_file.url} target="_blank" rel="noreferrer" size="sm">
              <Group gap={4}>
                <IconFileText size={16} />
                {lease.document_file.original_name}
              </Group>
            </Anchor>
          ) : (
            <Text size="sm" c="dimmed">No lease file uploaded</Text>
          )}
          <Anchor component={Link} to={`/homes/${homeId}/documents`} size="sm">
            All documents
          </Anchor>
        </Group>
      </Stack>
    </Card>
  )
}

function ContactCard({ home, onEdit }) {
  const copy = useCopy()
  const hasContacts = home.contact_name || home.contact_phone || home.contact_email
  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Title order={4}>{copy.contactTitle}</Title>
        <Button size="xs" variant="default" leftSection={<IconPencil size={14} />} onClick={onEdit}>
          Edit
        </Button>
      </Group>
      {hasContacts ? (
        <Stack gap={6}>
          {home.contact_name && <Text fw={500}>{home.contact_name}</Text>}
          {home.contact_phone && (
            <Anchor href={`tel:${home.contact_phone.replace(/\s/g, '')}`} size="sm">
              <Group gap={6}><IconPhone size={16} />{home.contact_phone}</Group>
            </Anchor>
          )}
          {home.contact_email && (
            <Anchor href={`mailto:${home.contact_email}`} size="sm">
              <Group gap={6}><IconMail size={16} />{home.contact_email}</Group>
            </Anchor>
          )}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">{copy.noContact}</Text>
      )}
      {home.notes && (
        <Text size="sm" mt="md" c="dimmed" style={{ whiteSpace: 'pre-line' }}>
          {home.notes}
        </Text>
      )}
    </Card>
  )
}

function UtilitiesCard({ homeId, utilities }) {
  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Title order={4}>Meters</Title>
        <Anchor component={Link} to={`/homes/${homeId}/utilities`} size="sm">
          Utilities & meters
        </Anchor>
      </Group>
      {utilities.length ? (
        <Stack gap={6}>
          {utilities.map((utility) => (
            <Group key={utility.id} justify="space-between" gap="xs">
              <Group gap={6}>
                <IconBolt size={16} color="var(--mantine-color-gray-6)" />
                <Text size="sm">{utility.name}</Text>
              </Group>
              <Text size="sm" c={utility.last_reading ? undefined : 'dimmed'}>
                {!utility.has_meter
                  ? 'No meter'
                  : utility.last_reading
                    ? `${Number(utility.last_reading.value)} ${utility.unit} · ${formatDate(utility.last_reading.reading_date)}`
                    : 'No readings yet'}
              </Text>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Add electricity, water, internet... to track bills and meter readings.
        </Text>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const copy = useCopy()
  const { homeId } = useParams()
  const dashboard = useDashboard(homeId)
  const [modal, setModal] = useState(null) // 'home' | 'lease-add' | 'lease-edit' | 'renew'
  const close = () => setModal(null)

  return (
    <QueryState query={dashboard}>
      {(data) => {
        const { property: home, next_rent: nextRent, overdue, this_month: month } = data
        const lease = home.active_contract
        const paidShare = Number(month.total) ? (Number(month.paid) / Number(month.total)) * 100 : 0
        return (
          <>
            <PageHeader
              title={home.title}
              subtitle={home.address}
              actions={
                <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setModal('home')}>
                  {copy.editHome}
                </Button>
              }
            />
            <ReminderList reminders={data.reminders} />

            <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
              <StatCard
                label={copy.nextRent}
                value={nextRent ? formatMoney(nextRent.amount) : '—'}
                hint={
                  <Group gap={6} mt={4}>
                    <IconCalendarDue size={16} color="var(--mantine-color-gray-6)" />
                    <Text size="sm" c="dimmed">
                      {nextRent ? `${formatDate(nextRent.due_date)}, ${relativeDays(nextRent.due_date)}` : copy.noUpcomingRent}
                    </Text>
                  </Group>
                }
              />
              <StatCard
                label={copy.statusLabels.overdue}
                value={overdue.count ? formatMoney(overdue.total) : 'Nothing'}
                color={overdue.count ? 'red' : 'teal'}
                hint={
                  <Text size="sm" c="dimmed" mt={4}>
                    {overdue.count ? copy.overdueSome(overdue.count) : copy.overdueNone}
                  </Text>
                }
              />
              <StatCard
                label="This month"
                value={formatMoney(month.total)}
                hint={
                  <Stack gap={6} mt={6}>
                    <Progress value={paidShare} size="sm" />
                    <Text size="sm" c="dimmed">
                      {formatMoney(month.paid)} {copy.monthPaid} · {formatMoney(month.unpaid)} {copy.monthLeft}
                    </Text>
                  </Stack>
                }
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <LeaseCard
                homeId={homeId}
                lease={lease}
                onAdd={() => setModal('lease-add')}
                onEdit={() => setModal('lease-edit')}
                onRenew={() => setModal('renew')}
              />
              <Stack>
                <ContactCard home={home} onEdit={() => setModal('home')} />
                <UtilitiesCard homeId={homeId} utilities={data.utilities} />
              </Stack>
            </SimpleGrid>

            <Group mt="lg" gap="xs">
              <Button component={Link} to={`/homes/${homeId}/payments`} variant="light">
                Payments & calendar
              </Button>
              <Button component={Link} to={`/homes/${homeId}/documents`} variant="light">
                {data.documents.condition} condition photos · {data.documents.total} files
              </Button>
            </Group>

            {modal === 'home' && <EditHomeModal home={home} opened onClose={close} />}
            {modal === 'lease-add' && <LeaseModal homeId={home.id} opened onClose={close} />}
            {modal === 'lease-edit' && <LeaseModal homeId={home.id} lease={lease} opened onClose={close} />}
            {modal === 'renew' && <RenewModal lease={lease} opened onClose={close} />}
          </>
        )
      }}
    </QueryState>
  )
}
