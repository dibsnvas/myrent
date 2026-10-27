import { ActionIcon, Anchor, Button, Group, Menu, SegmentedControl, Stack, Text } from '@mantine/core'
import { IconCheck, IconDots, IconDownload, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '../api/client'
import { useDashboard, useMonthSummary, usePayments, useSave, useUtilities } from '../api/queries'
import { QueryState } from '../components/common'
import { LeaseModal, MarkPaidModal, PaymentModal } from '../components/modals'
import { MonthSwitcher, Panel, StatusPill, Tile } from '../components/ui'
import { currentMonth, formatDate, formatMoney, ordinal } from '../lib/format'

const ROW_COLUMNS = '104px minmax(0, 1fr) 120px 96px 150px'

function PaymentRow({ payment, onPay, onEdit }) {
  const markUnpaid = useSave(() => api.post(`/payments/${payment.id}/mark-unpaid/`))
  const remove = useSave(() => api.delete(`/payments/${payment.id}/`), { success: 'Payment deleted' })
  const isPaid = payment.status === 'paid'
  return (
    <div className="mr-row mr-pay-row" style={{ gridTemplateColumns: ROW_COLUMNS }}>
      <div>
        <div className="mr-row-label">Date</div>
        <div className="mr-row-value">{formatDate(isPaid ? payment.paid_on : payment.due_date)}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="mr-row-label">Payment</div>
        <div className="mr-row-value">{payment.display_title}</div>
      </div>
      <div>
        <div className="mr-row-label">Sum</div>
        <div className="mr-row-value">{formatMoney(payment.amount)}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="mr-row-label">Bill</div>
        {payment.receipt_file ? (
          <Anchor href={payment.receipt_file.url} target="_blank" rel="noreferrer" size="sm" fw={600}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IconDownload size={14} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70 }}>{payment.receipt_file.original_name}</span>
          </Anchor>
        ) : <div className="mr-row-value" style={{ color: 'var(--mr-muted)' }}>—</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        {isPaid ? <StatusPill status="paid" /> : (
          <Button size="compact-sm" color={payment.status === 'overdue' ? 'red.8' : 'rose.7'} leftSection={<IconCheck size={14} />}
            onClick={onPay}>
            Pay
          </Button>
        )}
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" color="rose.7" aria-label="More"><IconDots size={16} /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={onEdit}>Edit</Menu.Item>
            {isPaid && (
              <Menu.Item leftSection={<IconX size={14} />} onClick={() => markUnpaid.mutate()}>Mark as unpaid</Menu.Item>
            )}
            <Menu.Item color="red" leftSection={<IconTrash size={14} />}
              onClick={() => window.confirm(`Delete "${payment.display_title}"?`) && remove.mutate()}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  )
}

function SummaryLine({ label, value, small }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs" pl={small ? 10 : 0}>
      <Text size={small ? 'xs' : 'sm'} c={small ? 'dimmed' : undefined}>{label}</Text>
      <Text size={small ? 'xs' : 'sm'} fw={small ? 400 : 600} c={small ? 'dimmed' : undefined}>{formatMoney(value)}</Text>
    </Group>
  )
}

/** US-11: rent and every bill of one month in one number, so a tenant on a fixed budget knows it in advance. */
function MonthSummary({ homeId }) {
  const [month, setMonth] = useState(currentMonth)
  const summary = useMonthSummary(homeId, month)
  const data = summary.data
  return (
    <Tile label="Housing cost per month">
      <MonthSwitcher month={month} onChange={setMonth} style={{ marginTop: 8 }} />
      <div className="mr-tile-value" style={{ marginTop: 8 }}>{data ? formatMoney(data.total) : '—'}</div>
      {data && Number(data.total) > 0 && (
        <Stack gap={3} mt={6}>
          <SummaryLine label="Rent" value={data.rent} />
          <SummaryLine label="Utilities" value={data.utilities} />
          {data.utilities_by_name.map((bill) => <SummaryLine key={bill.name} label={bill.name} value={bill.amount} small />)}
          {Number(data.other) > 0 && <SummaryLine label="Other" value={data.other} />}
          <div style={{ borderTop: '1px solid var(--mr-muted)', margin: '4px 0' }} />
          <SummaryLine label="Paid" value={data.paid} />
          <SummaryLine label="Left to pay" value={data.left} />
        </Stack>
      )}
      {data && Number(data.total) === 0 && <Text size="sm" c="dimmed" mt={4}>Nothing due this month.</Text>}
    </Tile>
  )
}

const FILTERS = {
  unpaid: (list) => list.filter((p) => p.status !== 'paid'),
  paid: (list) => list.filter((p) => p.status === 'paid').sort((a, b) => b.paid_on.localeCompare(a.paid_on)),
  all: (list) => list,
}

export default function PaymentsPage() {
  const { homeId } = useParams()
  const payments = usePayments(homeId)
  const dashboard = useDashboard(homeId)
  const utilities = useUtilities(homeId)
  const [filter, setFilter] = useState(null)
  const [modal, setModal] = useState(null) // { type: 'pay' | 'edit' | 'new' | 'lease', payment? }
  const close = () => setModal(null)

  const lease = dashboard.data?.property.active_contract
  const nextRent = dashboard.data?.next_rent
  const firstUnpaid = (payments.data ?? []).find((p) => p.status !== 'paid')

  return (
    <div className="mr-split">
      <Panel
        title="History of payments"
        actions={payments.data?.length > 0 && (
          <SegmentedControl size="xs" value={filter ?? (firstUnpaid ? 'unpaid' : 'paid')} onChange={setFilter}
            data={[{ value: 'unpaid', label: 'To pay' }, { value: 'paid', label: 'History' }, { value: 'all', label: 'All' }]} />
        )}
      >
        <QueryState query={payments}>
          {(list) => {
            if (!list.length) {
              return (
                <div className="mr-empty-add" style={{ cursor: 'default' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Text fw={500} mb="sm">Make your first payment</Text>
                    <Button leftSection={<IconPlus size={16} />} onClick={() => setModal({ type: 'new' })}>Add payment</Button>
                  </div>
                </div>
              )
            }
            const shown = FILTERS[filter ?? (firstUnpaid ? 'unpaid' : 'paid')](list)
            return (
              <div className="mr-scroll">
                {shown.length ? shown.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment}
                    onPay={() => setModal({ type: 'pay', payment })}
                    onEdit={() => setModal({ type: 'edit', payment })} />
                )) : <Text c="dimmed" ta="center" py="xl">Nothing here.</Text>}
              </div>
            )
          }}
        </QueryState>
      </Panel>

      <div className="mr-side">
        <Tile label="Monthly payment date" value={lease ? `${ordinal(lease.rent_due_day)} of each month` : '—'}
          onEdit={() => setModal({ type: 'lease' })} />
        <Tile label="Payment sum" value={lease ? formatMoney(lease.monthly_rent) : '—'} onEdit={() => setModal({ type: 'lease' })} />
        <Tile label="Next payment date" value={nextRent ? formatDate(nextRent.due_date) : '—'}
          sub={nextRent ? nextRent.display_title : undefined} />
        <Button size="md" disabled={!firstUnpaid} onClick={() => setModal({ type: 'pay', payment: firstUnpaid })}>
          Make payment
        </Button>
        <Button size="md" color="rose.4" leftSection={<IconPlus size={16} />} onClick={() => setModal({ type: 'new' })}>
          Add bill or other payment
        </Button>
        <MonthSummary homeId={homeId} />
      </div>

      {modal?.type === 'pay' && <MarkPaidModal payment={modal.payment} opened onClose={close} />}
      {(modal?.type === 'edit' || modal?.type === 'new') && (
        <PaymentModal homeId={Number(homeId)} payment={modal.payment ?? null} utilities={utilities.data ?? []} opened onClose={close} />
      )}
      {modal?.type === 'lease' && dashboard.data && (
        <LeaseModal homeId={Number(homeId)} lease={lease} opened onClose={close} />
      )}
    </div>
  )
}
