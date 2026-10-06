import { ActionIcon, Anchor, Button, Chip, Group, SimpleGrid, Text } from '@mantine/core'
import { IconChevronRight, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '../api/client'
import { useDocuments, useSave } from '../api/queries'
import { QueryState } from '../components/common'
import { ConditionPhotoModal } from '../components/modals'
import { Panel } from '../components/ui'
import { formatDate } from '../lib/format'

const STAGES = { before: 'Before', after: 'After' }

function StageCover({ base, stage, photos, onAdd }) {
  const [index, setIndex] = useState(0)
  const photo = photos[index]
  return (
    <div className="mr-photo-card" style={{ position: 'relative', minHeight: 360 }}>
      <Link to={`${base}/${stage}`} style={{ position: 'absolute', top: 14, left: 14, zIndex: 1 }} className="mr-stage-pill">
        {STAGES[stage]}
      </Link>
      {photo ? (
        <>
          <Link to={`${base}/${stage}`}>
            <img src={photo.url} alt={`${photo.room} ${photo.item}`} style={{ height: 320 }} />
          </Link>
          <Group justify="space-between" p="sm">
            <Text size="sm" fw={600}>{photo.room}{photo.item ? ` · ${photo.item}` : ''}</Text>
            <Group gap={6}>
              {photos.slice(0, 6).map((item, dot) => (
                <button key={item.id} type="button" aria-label={`Photo ${dot + 1}`} onClick={() => setIndex(dot)}
                  style={{ width: 7, height: 7, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                    background: dot === index ? 'var(--mr-dark)' : 'var(--mr-muted)' }} />
              ))}
            </Group>
          </Group>
        </>
      ) : (
        <div style={{ display: 'grid', placeItems: 'center', height: 340, textAlign: 'center', padding: 24 }}>
          <div>
            <Text c="dimmed" mb="sm">
              {stage === 'before' ? 'Photograph every room on the day you move in.' : 'Take the same photos when you move out.'}
            </Text>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={onAdd}>Add photo</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PhotoCard({ photo }) {
  const remove = useSave(() => api.delete(`/documents/${photo.id}/`), { success: 'Photo deleted' })
  return (
    <div className="mr-photo-card">
      <a href={photo.url} target="_blank" rel="noreferrer">
        <img src={photo.url} alt={`${photo.room} ${photo.item}`} />
      </a>
      <div style={{ padding: '10px 14px 14px', position: 'relative' }}>
        <Text fw={600} size="sm" pr={30}>{photo.item || photo.room}</Text>
        {photo.description && <Text size="xs" c="dimmed" mt={2}>{photo.description}</Text>}
        <Text size="xs" c="dimmed" mt={6}>{photo.room} · {formatDate(photo.taken_on)}</Text>
        <ActionIcon variant="subtle" color="red" size="sm" aria-label="Delete photo" style={{ position: 'absolute', top: 8, right: 8 }}
          onClick={() => window.confirm('Delete this photo?') && remove.mutate()}>
          <IconTrash size={14} />
        </ActionIcon>
      </div>
    </div>
  )
}

export default function ConditionPage() {
  const { homeId, stage } = useParams()
  const documents = useDocuments(homeId)
  const [room, setRoom] = useState('all')
  const [adding, setAdding] = useState(null) // stage to add to
  const base = `/homes/${homeId}/condition`

  return (
    <QueryState query={documents}>
      {(list) => {
        const photos = list.filter((doc) => doc.kind === 'condition')
        const byStage = (key) => photos.filter((photo) => photo.stage === key)
        const rooms = [...new Set(photos.map((photo) => photo.room).filter(Boolean))]

        if (!stage) {
          return (
            <Panel title="Housing gallery">
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {Object.keys(STAGES).map((key) => (
                  <StageCover key={key} base={base} stage={key} photos={byStage(key)} onAdd={() => setAdding(key)} />
                ))}
              </SimpleGrid>
              {adding && <ConditionPhotoModal homeId={Number(homeId)} stage={adding} rooms={rooms} opened onClose={() => setAdding(null)} />}
            </Panel>
          )
        }

        const stagePhotos = byStage(stage)
        const stageRooms = [...new Set(stagePhotos.map((photo) => photo.room).filter(Boolean))]
        const shown = room === 'all' ? stagePhotos : stagePhotos.filter((photo) => photo.room === room)
        return (
          <Panel
            title={
              <Group gap={6} component="span">
                <Anchor component={Link} to={base} c="var(--mr-dark-2)" fw={600} fz={20}>Housing gallery</Anchor>
                <IconChevronRight size={18} />
                <span>{STAGES[stage] ?? stage}</span>
                {room !== 'all' && (<><IconChevronRight size={18} /><span>{room}</span></>)}
              </Group>
            }
            actions={
              <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(stage)}>Add new notice</Button>
            }
          >
            {stageRooms.length > 1 && (
              <Chip.Group value={room} onChange={setRoom}>
                <Group gap={6} mb="md">
                  <Chip value="all" color="rose.7" variant="filled">All rooms</Chip>
                  {stageRooms.map((name) => <Chip key={name} value={name} color="rose.7" variant="filled">{name}</Chip>)}
                </Group>
              </Chip.Group>
            )}
            {shown.length ? (
              <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }}>
                {shown.map((photo) => <PhotoCard key={photo.id} photo={photo} />)}
              </SimpleGrid>
            ) : (
              <Text c="dimmed" ta="center" py={60}>No photos here yet.</Text>
            )}
            {adding && (
              <ConditionPhotoModal homeId={Number(homeId)} stage={adding} room={room === 'all' ? '' : room} rooms={rooms}
                opened onClose={() => setAdding(null)} />
            )}
          </Panel>
        )
      }}
    </QueryState>
  )
}
