import { Anchor, Badge, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconExternalLink, IconRefresh, IconUpload } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { useContracts, useDashboard } from '../api/queries'
import { QueryState } from '../components/common'
import { EditHomeModal, LeaseFileModal, LeaseModal, RenewModal } from '../components/modals'
import { EmptyAdd, Panel, Tile } from '../components/ui'
import { formatDate, formatMoney, leaseMonths, ordinal, PROPERTY_TYPES } from '../lib/format'

function LeasePreview({ file }) {
  if (!file) {
    return (
      <div style={{ height: 440, display: 'grid', placeItems: 'center', background: 'var(--mr-bg)', borderRadius: 20 }}>
        <Text c="dimmed" fw={500}>PDF</Text>
      </div>
    )
  }
  return file.is_image ? (
    <img src={file.url} alt="Lease" style={{ width: '100%', height: 440, objectFit: 'contain', background: 'var(--mr-bg)', borderRadius: 20 }} />
  ) : (
    <iframe title="Lease file" src={`${file.url}#toolbar=0&navpanes=0&view=FitH`} style={{ width: '100%', height: 440, border: 'none', borderRadius: 20, background: 'var(--mr-bg)' }} />
  )
}

function LeaseTiles({ home, lease, onEditHome, onEditLease }) {
  const months = leaseMonths(lease.start_date, lease.end_date)
  const type = PROPERTY_TYPES.find((option) => option.value === home.property_type)?.label
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Stack gap={14}>
          <Tile label="Landlord" value={home.landlord_name || '—'} tone="dark" onEdit={onEditHome} editLabel="Edit">
            <Stack gap={2} mt={6}>
              {home.landlord_phone && (
                <Anchor href={`tel:${home.landlord_phone.replace(/\s/g, '')}`} size="sm" c="var(--mr-bg)">{home.landlord_phone}</Anchor>
              )}
              {home.landlord_email && (
                <Anchor href={`mailto:${home.landlord_email}`} size="sm" c="var(--mr-bg)">{home.landlord_email}</Anchor>
              )}
            </Stack>
          </Tile>
          <Tile label="Data about house" value={home.address} sub={[type, home.notes].filter(Boolean).join(' · ')}
            tone="mid" onEdit={onEditHome} style={{ flex: 1 }} />
        </Stack>
        <Stack gap={14}>
          <Tile label="Rental period" value={`${months} ${months === 1 ? 'month' : 'months'}`}
            sub={`${formatDate(lease.start_date)} – ${formatDate(lease.end_date)}`} onEdit={onEditLease} />
          <Tile label="Payment" value={formatMoney(lease.monthly_rent)} sub={`on the ${ordinal(lease.rent_due_day)} of each month`}
            tone="dark" onEdit={onEditLease} />
          <Tile label="Deposit" value={formatMoney(lease.deposit)} onEdit={onEditLease} />
        </Stack>
      </div>
      {lease.terms && (
        <Tile label="Key terms" tone="soft" style={{ marginTop: 14 }} onEdit={onEditLease}>
          <Text size="sm" mt={6} style={{ whiteSpace: 'pre-line' }}>{lease.terms}</Text>
        </Tile>
      )}
    </>
  )
}

export default function ContractPage() {
  const { homeId } = useParams()
  const dashboard = useDashboard(homeId)
  const contracts = useContracts(homeId)
  const [modal, setModal] = useState(null) // 'home' | 'lease' | 'renew' | 'file'
  const close = () => setModal(null)

  return (
    <QueryState query={dashboard}>
      {({ property: home }) => {
        const lease = home.active_contract
        const history = (contracts.data ?? []).filter((item) => item.id !== lease?.id)
        return (
          <div className="mr-split" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 380px)' }}>
            <Panel
              title="Main aspects of contract"
              actions={lease && (
                <Group gap={6}>
                  {lease.is_expired && <Badge color="red" variant="light">Ended</Badge>}
                  {lease.previous && <Badge color="rose.7" variant="light">Renewal</Badge>}
                </Group>
              )}
            >
              {lease ? (
                <LeaseTiles home={home} lease={lease} onEditHome={() => setModal('home')} onEditLease={() => setModal('lease')} />
              ) : (
                <EmptyAdd onClick={() => setModal('lease')}>Add data about contract</EmptyAdd>
              )}
              {history.length > 0 && (
                <Stack gap={8} mt="lg">
                  <Text fw={600} c="var(--mr-dark-2)">Earlier leases</Text>
                  {history.map((item) => (
                    <div key={item.id} className="mr-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                      <Text size="sm" fw={600}>{formatDate(item.start_date)} – {formatDate(item.end_date)}</Text>
                      <Text size="sm">{formatMoney(item.monthly_rent)}</Text>
                      {item.document_file ? (
                        <Anchor href={item.document_file.url} target="_blank" rel="noreferrer" size="sm">File</Anchor>
                      ) : <Text size="sm" c="dimmed">No file</Text>}
                    </div>
                  ))}
                </Stack>
              )}
            </Panel>

            <Panel>
              <LeasePreview file={lease?.document_file} />
              <Stack gap={8} mt="md">
                <Button variant="outline" leftSection={<IconExternalLink size={16} />} disabled={!lease?.document_file}
                  component="a" href={lease?.document_file?.url} target="_blank" rel="noreferrer">
                  View
                </Button>
                <SimpleGrid cols={2} spacing={8}>
                  <Button color="rose.4" leftSection={<IconUpload size={16} />} disabled={!lease} onClick={() => setModal('file')}>
                    Upload
                  </Button>
                  <Button color="rose.5" leftSection={<IconRefresh size={16} />} disabled={!lease} onClick={() => setModal('renew')}>
                    Renew
                  </Button>
                </SimpleGrid>
                {!lease && <Text size="xs" c="dimmed" ta="center">Add the contract details first.</Text>}
              </Stack>
            </Panel>

            {modal === 'home' && <EditHomeModal home={home} opened onClose={close} />}
            {modal === 'lease' && <LeaseModal homeId={home.id} lease={lease} opened onClose={close} />}
            {modal === 'renew' && lease && <RenewModal lease={lease} opened onClose={close} />}
            {modal === 'file' && lease && <LeaseFileModal lease={lease} opened onClose={close} />}
          </div>
        )
      }}
    </QueryState>
  )
}
