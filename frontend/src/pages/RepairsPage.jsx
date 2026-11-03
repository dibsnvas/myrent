import { ActionIcon, Button, Menu, SegmentedControl, Text } from '@mantine/core'
import { IconCheck, IconDots, IconPencil, IconPlayerPlay, IconPlus, IconRotate, IconTool, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '../api/client'
import { useRepairs, useSave } from '../api/queries'
import { QueryState } from '../components/common'
import { RepairModal } from '../components/modals'
import { EmptyAdd, Panel, StatusPill, Tile } from '../components/ui'
import { formatDate } from '../lib/format'

const STATUS_LABELS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }
const ROW_COLUMNS = '56px minmax(0, 1fr) 104px 80px 140px'

const days = (count) => `${count} ${count === 1 ? 'day' : 'days'}`

const FILTERS = {
  active: (list) => list.filter((repair) => repair.status !== 'resolved'),
  resolved: (list) => list.filter((repair) => repair.status === 'resolved'),
  all: (list) => list,
}

function RepairRow({ repair, onEdit }) {
  const setStatus = useSave((status) => api.patch(`/repairs/${repair.id}/`, { status }), { success: 'Status updated' })
  const remove = useSave(() => api.delete(`/repairs/${repair.id}/`), { success: 'Repair request deleted' })
  const resolved = repair.status === 'resolved'
  return (
    <div className="mr-row mr-repair-row" style={{ gridTemplateColumns: ROW_COLUMNS }}>
      {repair.photo_file ? (
        <a href={repair.photo_file.url} target="_blank" rel="noreferrer" aria-label="Open photo">
          <img src={repair.photo_file.url} alt={repair.title} className="mr-repair-thumb" />
        </a>
      ) : (
        <span className="mr-icon-circle" style={{ width: 48, height: 48 }}><IconTool size={20} /></span>
      )}
      <div style={{ minWidth: 0 }}>
        <div className="mr-row-value">{repair.title}</div>
        {repair.description && <Text size="xs" c="dimmed" lineClamp={2}>{repair.description}</Text>}
      </div>
      <div>
        <div className="mr-row-label">Landlord told</div>
        <div className="mr-row-value">{formatDate(repair.reported_on)}</div>
      </div>
      <div>
        <div className="mr-row-label">{resolved ? 'Took' : 'Open for'}</div>
        <div className="mr-row-value">{days(repair.days_open)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <StatusPill status={repair.status} labels={STATUS_LABELS} />
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" color="rose.7" aria-label="More"><IconDots size={16} /></ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {!resolved && (
              <Menu.Item leftSection={<IconCheck size={14} />} onClick={() => setStatus.mutate('resolved')}>
                Fixed today
              </Menu.Item>
            )}
            {repair.status === 'open' && (
              <Menu.Item leftSection={<IconPlayerPlay size={14} />} onClick={() => setStatus.mutate('in_progress')}>
                Landlord is fixing it
              </Menu.Item>
            )}
            {resolved && (
              <Menu.Item leftSection={<IconRotate size={14} />} onClick={() => setStatus.mutate('open')}>
                Broken again
              </Menu.Item>
            )}
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={onEdit}>Edit</Menu.Item>
            <Menu.Item color="red" leftSection={<IconTrash size={14} />}
              onClick={() => window.confirm(`Delete "${repair.title}"?`) && remove.mutate()}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  )
}

/** US-12: what is broken, since when the landlord knows, and how long it has been open. */
export default function RepairsPage() {
  const { homeId } = useParams()
  const repairs = useRepairs(homeId)
  const [filter, setFilter] = useState('active')
  const [modal, setModal] = useState(null) // { repair? }
  const close = () => setModal(null)

  const list = repairs.data ?? []
  const active = FILTERS.active(list)
  const resolved = FILTERS.resolved(list)
  const oldest = active.reduce((max, repair) => Math.max(max, repair.days_open), 0)
  const averageFix = resolved.length
    ? Math.round(resolved.reduce((sum, repair) => sum + repair.days_open, 0) / resolved.length)
    : null

  return (
    <div className="mr-split">
      <Panel
        title="Repair requests"
        actions={list.length > 0 && (
          <SegmentedControl size="xs" value={filter} onChange={setFilter}
            data={[{ value: 'active', label: 'Not fixed' }, { value: 'resolved', label: 'Fixed' }, { value: 'all', label: 'All' }]} />
        )}
      >
        <QueryState query={repairs}>
          {(items) => {
            if (!items.length) return <EmptyAdd onClick={() => setModal({})}>Add a repair request</EmptyAdd>
            const shown = FILTERS[filter](items)
            return (
              <div className="mr-scroll">
                {shown.length ? shown.map((repair) => (
                  <RepairRow key={repair.id} repair={repair} onEdit={() => setModal({ repair })} />
                )) : <Text c="dimmed" ta="center" py="xl">Nothing here.</Text>}
              </div>
            )
          }}
        </QueryState>
      </Panel>

      <div className="mr-side">
        <Tile tone="dark" label="Not fixed yet" value={String(active.length)}
          sub={active.length ? `Oldest is open for ${days(oldest)}` : 'Nothing is broken'} />
        <Tile label="Fixed" value={String(resolved.length)}
          sub={averageFix !== null ? `On average in ${days(averageFix)}` : undefined} />
        <Button size="md" leftSection={<IconPlus size={16} />} onClick={() => setModal({})}>New repair request</Button>
        <Text size="xs" c="dimmed" px={4}>
          Tell the landlord first, then write down the date here. The counter shows how long the problem has been open,
          which helps if the landlord is slow or the deposit is discussed at move-out.
        </Text>
      </div>

      {modal && <RepairModal homeId={Number(homeId)} repair={modal.repair ?? null} opened onClose={close} />}
    </div>
  )
}
