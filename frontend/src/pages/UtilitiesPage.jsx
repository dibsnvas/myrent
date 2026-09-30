import { ActionIcon, Anchor, Badge, Button, Card, Group, Menu, Select, Table, Text, Title } from '@mantine/core'
import { IconBolt, IconDots, IconGauge, IconPencil, IconPhoto, IconPlus, IconReceipt, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '../api/client'
import { useDashboard, useReadings, useSave, useUtilities } from '../api/queries'
import { EmptyState, PageHeader, QueryState } from '../components/common'
import { PaymentModal, ReadingModal, UtilityModal } from '../components/modals'
import { formatDate } from '../lib/format'

function UtilityRow({ utility, onReading, onBill, onEdit }) {
  const remove = useSave(() => api.delete(`/utilities/${utility.id}/`), { success: `${utility.name} deleted` })
  const last = utility.last_reading
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={500}>{utility.name}</Text>
        <Text size="xs" c="dimmed">{utility.has_meter ? `Meter${utility.unit ? `, ${utility.unit}` : ''}` : 'No meter'}</Text>
      </Table.Td>
      <Table.Td>
        {last ? (
          <>
            <Text size="sm">{Number(last.value)} {utility.unit}</Text>
            <Text size="xs" c="dimmed">{formatDate(last.reading_date)}</Text>
          </>
        ) : (
          <Text size="sm" c="dimmed">—</Text>
        )}
      </Table.Td>
      <Table.Td>
        {last?.consumption ? <Badge variant="light">+{Number(last.consumption)} {utility.unit}</Badge> : '—'}
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify="flex-end" wrap="nowrap">
          {utility.has_meter && (
            <Button size="compact-sm" variant="light" leftSection={<IconGauge size={14} />} onClick={onReading}>
              Reading
            </Button>
          )}
          <Button size="compact-sm" variant="default" leftSection={<IconReceipt size={14} />} onClick={onBill}>
            Bill
          </Button>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="More">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPencil size={14} />} onClick={onEdit}>Edit</Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() =>
                  window.confirm(`Delete ${utility.name}? Its meter readings are deleted too; bills stay.`) &&
                  remove.mutate()
                }
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Table.Td>
    </Table.Tr>
  )
}

function ReadingHistory({ homeId, utilities }) {
  const [utilityId, setUtilityId] = useState(null)
  const readings = useReadings(homeId, utilityId)
  const remove = useSave((id) => api.delete(`/meter-readings/${id}/`), { success: 'Reading deleted' })
  const units = Object.fromEntries(utilities.map((utility) => [utility.id, utility]))
  const metered = utilities.filter((utility) => utility.has_meter)

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="sm">
        <Title order={4}>Reading history</Title>
        <Select
          placeholder="All meters"
          clearable
          w={200}
          data={metered.map((utility) => ({ value: String(utility.id), label: utility.name }))}
          value={utilityId}
          onChange={setUtilityId}
        />
      </Group>
      <QueryState query={readings}>
        {(list) =>
          list.length ? (
            <Table.ScrollContainer minWidth={520}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Meter</Table.Th>
                    <Table.Th>Value</Table.Th>
                    <Table.Th>Used</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {list.map((reading) => {
                    const utility = units[reading.utility]
                    return (
                      <Table.Tr key={reading.id}>
                        <Table.Td>{formatDate(reading.reading_date)}</Table.Td>
                        <Table.Td>{utility?.name}</Table.Td>
                        <Table.Td>{Number(reading.value)} {utility?.unit}</Table.Td>
                        <Table.Td>{reading.consumption ? `+${Number(reading.consumption)}` : '—'}</Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            {reading.photo_file && (
                              <ActionIcon component="a" href={reading.photo_file.url} target="_blank" rel="noreferrer"
                                variant="subtle" aria-label="Meter photo">
                                <IconPhoto size={16} />
                              </ActionIcon>
                            )}
                            <ActionIcon variant="subtle" color="red" aria-label="Delete reading"
                              onClick={() => window.confirm('Delete this reading?') && remove.mutate(reading.id)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <Text size="sm" c="dimmed">No readings yet.</Text>
          )
        }
      </QueryState>
    </Card>
  )
}

export default function UtilitiesPage() {
  const { homeId } = useParams()
  const utilities = useUtilities(homeId)
  const dashboard = useDashboard(homeId)
  const [modal, setModal] = useState(null) // { type: 'utility' | 'reading' | 'bill', utility? }
  const close = () => setModal(null)
  const meterDay = dashboard.data?.property.meter_reading_day

  return (
    <>
      <PageHeader
        title="Utilities & meters"
        subtitle={
          meterDay
            ? `Meter readings are due on day ${meterDay} of each month.`
            : 'Set the meter-reading day in "Edit home" on the dashboard to get reminders.'
        }
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModal({ type: 'utility' })}>
            Add utility
          </Button>
        }
      />
      <QueryState query={utilities}>
        {(list) =>
          list.length ? (
            <>
              <Card withBorder padding="md" mb="lg">
                <Table.ScrollContainer minWidth={600}>
                  <Table verticalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Utility</Table.Th>
                        <Table.Th>Last reading</Table.Th>
                        <Table.Th>Used since previous</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {list.map((utility) => (
                        <UtilityRow
                          key={utility.id}
                          utility={utility}
                          onReading={() => setModal({ type: 'reading', utility })}
                          onBill={() => setModal({ type: 'bill', utility })}
                          onEdit={() => setModal({ type: 'utility', utility })}
                        />
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
                <Text size="xs" c="dimmed" mt="xs">
                  Bills appear on the <Anchor component={Link} to={`/homes/${homeId}/payments`} size="xs">payments calendar</Anchor>.
                </Text>
              </Card>
              <ReadingHistory homeId={homeId} utilities={list} />
            </>
          ) : (
            <Card withBorder>
              <EmptyState
                icon={IconBolt}
                title="No utilities yet"
                text="Add each utility you pay for: electricity, water, heating, gas, internet. Turn on “has a meter” for the ones you read every month."
                action={<Button onClick={() => setModal({ type: 'utility' })}>Add utility</Button>}
              />
            </Card>
          )
        }
      </QueryState>

      {modal?.type === 'utility' && <UtilityModal homeId={Number(homeId)} utility={modal.utility} opened onClose={close} />}
      {modal?.type === 'reading' && <ReadingModal homeId={Number(homeId)} utility={modal.utility} opened onClose={close} />}
      {modal?.type === 'bill' && (
        <PaymentModal
          homeId={Number(homeId)}
          preset={{ kind: 'utility', utility: String(modal.utility.id) }}
          utilities={utilities.data ?? []}
          opened
          onClose={close}
        />
      )}
    </>
  )
}
