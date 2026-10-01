import { Anchor, Badge, Button, Card, Group, Progress, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { IconBuildingCommunity, IconChevronRight, IconPlus } from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router-dom'

import { useOverview, useReminders } from '../api/queries'
import { useCopy } from '../auth/useCopy'
import { EmptyState, PageHeader, QueryState, ReminderList } from '../components/common'
import { formatDate, formatMoney, monthLabel } from '../lib/format'

const MONTH_STATUS_COLOR = { paid: 'teal', due: 'blue', overdue: 'red', none: 'gray' }

function MonthStatus({ row }) {
  const copy = useCopy()
  const label = row.month_status === 'none' ? 'No rent this month' : copy.statusLabels[row.month_status]
  return (
    <Stack gap={2}>
      <Badge color={MONTH_STATUS_COLOR[row.month_status]} variant="light">
        {label}
      </Badge>
      {row.overdue_count > 0 && (
        <Text size="xs" c="red">
          {formatMoney(row.overdue_total)} late
        </Text>
      )}
    </Stack>
  )
}

function Stat({ label, value, color, children }) {
  return (
    <Card withBorder padding="lg">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text fz={26} fw={700} c={color} mt={4}>
        {value}
      </Text>
      {children}
    </Card>
  )
}

/** Landlord home screen: every property, this month's rent status, late payments, leases ending. */
export default function PortfolioPage() {
  const copy = useCopy()
  const navigate = useNavigate()
  const overview = useOverview()
  const reminders = useReminders()

  return (
    <QueryState query={overview}>
      {({ month, properties, totals }) => {
        if (!properties.length) {
          return (
            <EmptyState
              icon={IconBuildingCommunity}
              title={copy.emptyTitle}
              text={copy.emptyText}
              action={
                <Button component={Link} to="/homes/new" mt="sm">
                  {copy.addHome}
                </Button>
              }
            />
          )
        }
        const receivedShare = Number(totals.month_expected)
          ? (Number(totals.month_received) / Number(totals.month_expected)) * 100
          : 0
        return (
          <>
            <PageHeader
              title="Your properties"
              subtitle={`${monthLabel(month)} · ${totals.leased} of ${totals.properties} rented out`}
              actions={
                <Button component={Link} to="/homes/new" leftSection={<IconPlus size={16} />}>
                  {copy.addHome}
                </Button>
              }
            />
            <ReminderList reminders={reminders.data ?? []} showProperty />

            <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
              <Stat label="Rent expected this month" value={formatMoney(totals.month_expected)} />
              <Stat label="Received" value={formatMoney(totals.month_received)}>
                <Progress value={receivedShare} size="sm" mt={8} />
              </Stat>
              <Stat
                label="Late rent"
                value={totals.overdue_count ? formatMoney(totals.overdue_total) : 'Nothing'}
                color={totals.overdue_count ? 'red' : 'teal'}
              >
                <Text size="sm" c="dimmed" mt={4}>
                  {totals.overdue_count ? copy.overdueSome(totals.overdue_count) : 'Everyone has paid'}
                </Text>
              </Stat>
            </SimpleGrid>

            <Card withBorder padding="md">
              <Table.ScrollContainer minWidth={760}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Property</Table.Th>
                      <Table.Th>Tenant</Table.Th>
                      <Table.Th ta="right">Rent / month</Table.Th>
                      <Table.Th>{monthLabel(month).split(' ')[0]}</Table.Th>
                      <Table.Th>Lease ends</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {properties.map((row) => (
                      <Table.Tr
                        key={row.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/homes/${row.id}`)}
                      >
                        <Table.Td>
                          <Text size="sm" fw={600}>{row.title}</Text>
                          <Text size="xs" c="dimmed">{row.address}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{row.contact_name || '—'}</Text>
                          {row.contact_phone && (
                            <Anchor
                              href={`tel:${row.contact_phone.replace(/\s/g, '')}`}
                              size="xs"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {row.contact_phone}
                            </Anchor>
                          )}
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          {formatMoney(row.monthly_rent)}
                        </Table.Td>
                        <Table.Td>
                          <MonthStatus row={row} />
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <Text size="sm">{formatDate(row.lease_end)}</Text>
                            {row.lease_ends_soon && <Badge color="orange" variant="light">Soon</Badge>}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <IconChevronRight size={18} color="var(--mantine-color-gray-5)" />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          </>
        )
      }}
    </QueryState>
  )
}
