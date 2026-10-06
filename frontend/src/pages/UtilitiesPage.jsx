import { ActionIcon, Anchor, Button, Group, Menu, Modal, Stack, Text } from '@mantine/core'
import {
  IconBolt,
  IconDots,
  IconDroplet,
  IconFlame,
  IconGauge,
  IconHistory,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconReceipt,
  IconRipple,
  IconTrash,
  IconWifi,
} from '@tabler/icons-react'
import { createElement, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '../api/client'
import { useDashboard, usePayments, useReadings, useSave, useUtilities } from '../api/queries'
import { QueryState } from '../components/common'
import { EditHomeModal, PaymentModal, ReadingModal, UtilityModal } from '../components/modals'
import { EmptyAdd, Panel, Tile } from '../components/ui'
import { formatDate, formatMoney, ordinal } from '../lib/format'

const ICONS = [
  [/electr|свет|power/i, IconBolt],
  [/gas|газ/i, IconFlame],
  [/water|вод/i, IconDroplet],
  [/heat|отоп/i, IconRipple],
  [/trash|garbage|мусор/i, IconTrash],
  [/internet|wi-?fi|интернет/i, IconWifi],
]
const iconFor = (name) => ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? IconGauge

function ReadingHistory({ homeId, utility, onClose }) {
  const readings = useReadings(homeId, utility.id)
  const remove = useSave((id) => api.delete(`/meter-readings/${id}/`), { success: 'Reading deleted' })
  return (
    <Modal opened onClose={onClose} title={`${utility.name}: readings`} size="lg">
      <QueryState query={readings}>
        {(list) => list.length ? (
          <Stack gap={8}>
            {list.map((reading) => (
              <div key={reading.id} className="mr-row" style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
                <div><div className="mr-row-label">Date</div><div className="mr-row-value">{formatDate(reading.reading_date)}</div></div>
                <div><div className="mr-row-label">Value</div><div className="mr-row-value">{Number(reading.value)} {utility.unit}</div></div>
                <div><div className="mr-row-label">Used</div><div className="mr-row-value">{reading.consumption ? `+${Number(reading.consumption)}` : '—'}</div></div>
                <Group gap={4} wrap="nowrap">
                  {reading.photo_file && (
                    <ActionIcon component="a" href={reading.photo_file.url} target="_blank" rel="noreferrer" variant="subtle"
                      color="rose.7" aria-label="Meter photo"><IconPhoto size={16} /></ActionIcon>
                  )}
                  <ActionIcon variant="subtle" color="red" aria-label="Delete reading"
                    onClick={() => window.confirm('Delete this reading?') && remove.mutate(reading.id)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </div>
            ))}
          </Stack>
        ) : <Text c="dimmed">No readings yet.</Text>}
      </QueryState>
    </Modal>
  )
}

function UtilityRow({ utility, onReading, onBill, onEdit, onHistory }) {
  const remove = useSave(() => api.delete(`/utilities/${utility.id}/`), { success: `${utility.name} deleted` })
  const last = utility.last_reading
  return (
    <div className="mr-row" style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}>
      <span className="mr-icon-circle">{createElement(iconFor(utility.name), { size: 20 })}</span>
      <button type="button" onClick={onHistory}
        style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', minWidth: 0, font: 'inherit' }}>
        <div className="mr-row-value" style={{ fontSize: 16 }}>{utility.name}</div>
        <div className="mr-row-label" style={{ fontSize: 12 }}>
          {utility.has_meter
            ? last ? `Last reading ${Number(last.value)} ${utility.unit} · ${formatDate(last.reading_date)}${last.consumption ? ` · +${Number(last.consumption)} used` : ''}` : 'Meter · no readings yet'
            : 'No meter'}
        </div>
      </button>
      <Group gap={6} wrap="nowrap">
        {utility.has_meter && (
          <Button size="compact-sm" leftSection={<IconGauge size={14} />} onClick={onReading}>Reading</Button>
        )}
        <Button size="compact-sm" color="rose.4" leftSection={<IconReceipt size={14} />} onClick={onBill}>Bill</Button>
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" color="rose.7" aria-label="More"><IconDots size={16} /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {utility.has_meter && <Menu.Item leftSection={<IconHistory size={14} />} onClick={onHistory}>Reading history</Menu.Item>}
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={onEdit}>Edit</Menu.Item>
            <Menu.Item color="red" leftSection={<IconTrash size={14} />}
              onClick={() => window.confirm(`Delete ${utility.name}? Its meter readings are deleted too; bills stay.`) && remove.mutate()}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </div>
  )
}

export default function UtilitiesPage() {
  const { homeId } = useParams()
  const utilities = useUtilities(homeId)
  const dashboard = useDashboard(homeId)
  const payments = usePayments(homeId)
  const [modal, setModal] = useState(null) // { type: 'utility' | 'reading' | 'bill' | 'history' | 'home', utility? }
  const close = () => setModal(null)

  const home = dashboard.data?.property
  const lastPaid = (payments.data ?? [])
    .filter((p) => p.kind === 'utility' && p.paid_on)
    .sort((a, b) => b.paid_on.localeCompare(a.paid_on))[0]
  const nextBill = dashboard.data?.next_utility_bill

  return (
    <div className="mr-split">
      <Panel title="Utility categories">
        <QueryState query={utilities}>
          {(list) => list.length ? (
            <>
              <div className="mr-scroll">
                {list.map((utility) => (
                  <UtilityRow key={utility.id} utility={utility}
                    onReading={() => setModal({ type: 'reading', utility })}
                    onBill={() => setModal({ type: 'bill', utility })}
                    onEdit={() => setModal({ type: 'utility', utility })}
                    onHistory={() => setModal({ type: 'history', utility })} />
                ))}
              </div>
              <Group justify="center" mt="lg">
                <Button leftSection={<IconPlus size={16} />} onClick={() => setModal({ type: 'utility' })}>Add new category</Button>
              </Group>
            </>
          ) : <EmptyAdd onClick={() => setModal({ type: 'utility' })}>Add category</EmptyAdd>}
        </QueryState>
      </Panel>

      <div className="mr-side">
        <Tile label="Meter readings day" value={home?.meter_reading_day ? `${ordinal(home.meter_reading_day)} of each month` : 'Not set'}
          sub={home?.meter_reading_day ? undefined : 'Set it to get a reminder'} onEdit={() => setModal({ type: 'home' })} />
        <Tile label="Last payment date" value={lastPaid ? formatDate(lastPaid.paid_on) : '—'}
          sub={lastPaid ? `${lastPaid.display_title} · ${formatMoney(lastPaid.amount)}` : undefined} />
        <Tile label="Next payment date" value={nextBill ? formatDate(nextBill.due_date) : '—'}
          sub={nextBill ? `${nextBill.display_title} · ${formatMoney(nextBill.amount)}` : undefined} />
        <Tile label="Payment average sum" value={dashboard.data?.average_utility_bill ? formatMoney(dashboard.data.average_utility_bill) : '—'}
          sub="per month, last 3 months" />
        <Text size="xs" c="dimmed" px={4}>
          Bills also appear on <Anchor component={Link} to={`/homes/${homeId}/payments`} size="xs">Payments</Anchor> and in the calendar.
        </Text>
      </div>

      {modal?.type === 'utility' && <UtilityModal homeId={Number(homeId)} utility={modal.utility} opened onClose={close} />}
      {modal?.type === 'reading' && <ReadingModal homeId={Number(homeId)} utility={modal.utility} opened onClose={close} />}
      {modal?.type === 'history' && <ReadingHistory homeId={homeId} utility={modal.utility} onClose={close} />}
      {modal?.type === 'home' && home && <EditHomeModal home={home} opened onClose={close} />}
      {modal?.type === 'bill' && (
        <PaymentModal homeId={Number(homeId)} preset={{ kind: 'utility', utility: String(modal.utility.id) }}
          utilities={utilities.data ?? []} opened onClose={close} />
      )}
    </div>
  )
}
