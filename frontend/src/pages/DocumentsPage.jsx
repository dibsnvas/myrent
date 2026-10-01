import { ActionIcon, Anchor, Badge, Button, Card, Group, Image, SimpleGrid, Stack, Table, Tabs, Text } from '@mantine/core'
import { IconCamera, IconFile, IconFileText, IconPhoto, IconTrash, IconUpload } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '../api/client'
import { useDocuments, useSave } from '../api/queries'
import { useCopy } from '../auth/useCopy'
import { EmptyState, PageHeader, QueryState } from '../components/common'
import { UploadModal } from '../components/modals'
import { formatBytes, formatDate } from '../lib/format'

const KIND_LABELS = { lease: 'Lease', renewal: 'Renewal', receipt: 'Receipt', meter: 'Meter photo', other: 'Other' }

function useDelete() {
  return useSave((id) => api.delete(`/documents/${id}/`), { success: 'Deleted' })
}

function ConditionLog({ photos, onUpload }) {
  const copy = useCopy()
  const remove = useDelete()
  if (!photos.length) {
    return (
      <EmptyState
        icon={IconCamera}
        title="No condition photos yet"
        text={copy.conditionHint}
        action={<Button leftSection={<IconUpload size={16} />} onClick={onUpload}>Upload photo</Button>}
      />
    )
  }
  const rooms = photos.reduce((groups, photo) => {
    ;(groups[photo.room || 'Other'] ??= []).push(photo)
    return groups
  }, {})
  return (
    <Stack gap="xl">
      {Object.entries(rooms).map(([room, roomPhotos]) => (
        <div key={room}>
          <Text fw={600} mb="xs">{room}</Text>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }}>
            {roomPhotos.map((photo) => (
              <Card key={photo.id} withBorder padding="sm">
                <Card.Section>
                  <Anchor href={photo.url} target="_blank" rel="noreferrer">
                    <Image src={photo.url} h={180} fit="cover" alt={`${room}: ${photo.description || 'photo'}`} />
                  </Anchor>
                </Card.Section>
                <Group justify="space-between" mt="sm" gap="xs" wrap="nowrap">
                  <Badge variant="light" color="gray">{formatDate(photo.taken_on)}</Badge>
                  <ActionIcon variant="subtle" color="red" aria-label="Delete photo"
                    onClick={() => window.confirm('Delete this photo?') && remove.mutate(photo.id)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
                {photo.description && <Text size="sm" mt={6}>{photo.description}</Text>}
              </Card>
            ))}
          </SimpleGrid>
        </div>
      ))}
    </Stack>
  )
}

function FileTable({ files }) {
  const remove = useDelete()
  if (!files.length) return <Text size="sm" c="dimmed" py="md">Nothing here yet.</Text>
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>File</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Uploaded</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {files.map((file) => (
            <Table.Tr key={file.id}>
              <Table.Td>
                <Anchor href={file.url} target="_blank" rel="noreferrer" size="sm">
                  <Group gap={6} wrap="nowrap">
                    {file.is_image ? <IconPhoto size={16} /> : <IconFileText size={16} />}
                    {file.original_name}
                  </Group>
                </Anchor>
                {file.description && <Text size="xs" c="dimmed">{file.description}</Text>}
              </Table.Td>
              <Table.Td>{KIND_LABELS[file.kind]}</Table.Td>
              <Table.Td>{formatDate(file.uploaded_at.slice(0, 10))}</Table.Td>
              <Table.Td>{formatBytes(file.size)}</Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="red" aria-label="Delete file"
                  onClick={() => window.confirm(`Delete ${file.original_name}?`) && remove.mutate(file.id)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

export default function DocumentsPage() {
  const { homeId } = useParams()
  const documents = useDocuments(homeId)
  const [tab, setTab] = useState('condition')
  const [uploading, setUploading] = useState(false)

  return (
    <>
      <PageHeader
        title="Documents & photos"
        subtitle="Stored privately. Files open through links that expire after 10 minutes."
        actions={
          <Button leftSection={<IconUpload size={16} />} onClick={() => setUploading(true)}>
            Upload
          </Button>
        }
      />
      <QueryState query={documents}>
        {(list) => {
          const photos = list.filter((doc) => doc.kind === 'condition')
          const leases = list.filter((doc) => ['lease', 'renewal'].includes(doc.kind))
          const others = list.filter((doc) => !['condition', 'lease', 'renewal'].includes(doc.kind))
          return (
            <Card withBorder padding="md">
              <Tabs value={tab} onChange={setTab}>
                <Tabs.List mb="md">
                  <Tabs.Tab value="condition" leftSection={<IconCamera size={16} />}>
                    Condition log ({photos.length})
                  </Tabs.Tab>
                  <Tabs.Tab value="lease" leftSection={<IconFileText size={16} />}>
                    Lease & renewals ({leases.length})
                  </Tabs.Tab>
                  <Tabs.Tab value="other" leftSection={<IconFile size={16} />}>
                    Receipts & other ({others.length})
                  </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="condition">
                  <ConditionLog photos={photos} onUpload={() => setUploading(true)} />
                </Tabs.Panel>
                <Tabs.Panel value="lease">
                  <FileTable files={leases} />
                </Tabs.Panel>
                <Tabs.Panel value="other">
                  <FileTable files={others} />
                </Tabs.Panel>
              </Tabs>
            </Card>
          )
        }}
      </QueryState>
      {uploading && (
        <UploadModal
          homeId={Number(homeId)}
          defaultKind={tab === 'lease' ? 'lease' : tab === 'other' ? 'receipt' : 'condition'}
          opened
          onClose={() => setUploading(false)}
        />
      )}
    </>
  )
}
