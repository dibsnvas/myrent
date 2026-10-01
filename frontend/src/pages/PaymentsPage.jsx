import { ActionIcon, Anchor, Button, Card, Group, Menu, Table, Text, Title } from '@mantine/core'
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconPencil,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '../api/client'
import { useCalendar, usePayments, useSave, useUtilities } from '../api/queries'
import { EmptyState, PageHeader, QueryState, StatusBadge } from '../components/common'
import { PaymentModal } from '../components/modals'
import MonthCalendar from '../components/MonthCalendar'
import { currentMonth, formatDate, formatMoney, monthLabel, shiftMonth } from '../lib/format'

function PaymentRow({ payment, onEdit }) {
  const markPaid = useSave(() => api.post(`/payments/${payment.id}/mark-paid/`, {}), { success: 'Marked as paid' })
  const markUnpaid = useSave(() => api.post(`/payments/${payment.id}/mark-unpaid/`))
  const remove = useSave(() => api.delete(`/payments/${payment.id}/`), { success: 'Payment deleted' })
  const isPaid = payment.status === 'paid'

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={500}>{payment.display_title}</Text>
          {payment.receipt_file && (
            <Anchor href={payment.receipt_file.url} target="_blank" rel="noreferrer" aria-label="Receipt">
              <IconReceipt size={16} />
            </Anchor>
          )}
        </Group>
        {payment.note && <Text size="xs" c="dimmed">{payment.note}</Text>}
      </Table.Td>
      <Table.Td>{formatDate(payment.due_date)}</Table.Td>
      <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>{formatMoney(payment.amount)}</Table.Td>
      <Table.Td>
        <StatusBadge status={payment.status} />
        {isPaid && <Text size="xs" c="dimmed">{formatDate(payment.paid_on)}</Text>}
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify="flex-end" wrap="nowrap">
          {!isPaid && (
            <Button size="compact-sm" variant="light" leftSection={<IconCheck size={14} />}
              loading={markPaid.isPending} onClick={() => markPaid.mutate()}>
              Paid
            </Button>
          )}
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="More">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPencil size={14} />} onClick={onEdit}>Edit</Menu.Item>
              {isPaid && (
                <Menu.Item leftSection={<IconX size={14} />} onClick={() => markUnpaid.mutate()}>
                  Mark as unpaid
                </Menu.Item>
              )}
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => window.confirm(`Delete "${payment.display_title}"?`) && remove.mutate()}
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

export default function PaymentsPage() {
  const { homeId } = useParams()
  const [month, setMonth] = useState(currentMonth)
  const payments = usePayments(homeId, month)
  const calendar = useCalendar(homeId, month)
  const utilities = useUtilities(homeId)
  const [editing, setEditing] = useState(null) // null | 'new' | payment

  const totals = (payments.data ?? []).reduce(
    (sum, payment) => ({
      all: sum.all + Number(payment.amount),
      paid: sum.paid + (payment.status === 'paid' ? Number(payment.amount) : 0),
    }),
    { all: 0, paid: 0 },
  )

  return (
    <>
      <PageHeader
        title="Payments & calendar"
        subtitle="Rent is created from your lease. Add utility bills and anything else you pay for the home."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
            Add payment
          </Button>
        }
      />

      <Card withBorder padding="md" mb="lg">
        <Group justify="space-between" mb="sm">
          <ActionIcon variant="default" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Group gap="xs">
            <Title order={4}>{monthLabel(month)}</Title>
            {month !== currentMonth() && (
              <Button size="compact-xs" variant="subtle" onClick={() => setMonth(currentMonth())}>
                Today
              </Button>
            )}
          </Group>
          <ActionIcon variant="default" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
        <MonthCalendar month={month} events={calendar.data ?? []} />
      </Card>

      <Card withBorder padding="md">
        <Group justify="space-between" mb="sm">
          <Title order={4}>Payments in {monthLabel(month)}</Title>
          <Text size="sm" c="dimmed">
            {formatMoney(totals.paid)} of {formatMoney(totals.all)} paid
          </Text>
        </Group>
        <QueryState query={payments}>
          {(list) =>
            list.length ? (
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Payment</Table.Th>
                      <Table.Th>Due</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.map((payment) => (
                      <PaymentRow key={payment.id} payment={payment} onEdit={() => setEditing(payment)} />
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : (
              <EmptyState title="Nothing due this month" text="Use “Add payment” for a utility bill or a one-off cost." />
            )
          }
        </QueryState>
      </Card>

      {editing && (
        <PaymentModal
          homeId={Number(homeId)}
          payment={editing === 'new' ? null : editing}
          utilities={utilities.data ?? []}
          opened
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
