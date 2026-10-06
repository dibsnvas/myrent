import { Avatar, Button, Group, List, Modal, PasswordInput, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'

import { api, fieldErrors } from '../api/client'
import { useSave } from '../api/queries'
import { useAuth } from '../auth/useAuth'
import { Panel, Tile } from '../components/ui'

function ModalButtons({ onClose, loading, label = 'Save', color }) {
  return (
    <Group justify="flex-end" mt="lg">
      <Button variant="default" onClick={onClose}>Cancel</Button>
      <Button type="submit" loading={loading} color={color}>{label}</Button>
    </Group>
  )
}

function NameModal({ onClose }) {
  const { user, setUser } = useAuth()
  const form = useForm({
    initialValues: { first_name: user.first_name, last_name: user.last_name },
    validate: { first_name: (value) => (value.trim() ? null : 'Enter your name') },
  })
  const save = useSave((values) => api.patch('/auth/me/', values), { success: 'Name saved' })
  return (
    <Modal opened onClose={onClose} title="Your name">
      <form onSubmit={form.onSubmit((values) => save.mutate(values, { onSuccess: ({ data }) => { setUser(data); onClose() } }))}>
        <SimpleGrid cols={2}>
          <TextInput label="Name" {...form.getInputProps('first_name')} />
          <TextInput label="Surname" {...form.getInputProps('last_name')} />
        </SimpleGrid>
        <ModalButtons onClose={onClose} loading={save.isPending} />
      </form>
    </Modal>
  )
}

function PasswordModal({ onClose }) {
  const form = useForm({
    initialValues: { current_password: '', new_password: '', confirm: '' },
    validate: {
      new_password: (value) => (value.length >= 8 ? null : 'At least 8 characters, not only numbers'),
      confirm: (value, values) => (value === values.new_password ? null : 'Passwords do not match'),
    },
  })
  const save = useSave(({ confirm: _confirm, ...values }) => api.post('/auth/password/', values),
    { success: 'Password changed', notifyErrors: false })
  return (
    <Modal opened onClose={onClose} title="Change password">
      <form onSubmit={form.onSubmit((values) =>
        save.mutate(values, { onSuccess: onClose, onError: (error) => form.setErrors(fieldErrors(error)) }))}>
        <Stack>
          <PasswordInput label="Current password" autoComplete="current-password" {...form.getInputProps('current_password')} />
          <PasswordInput label="New password" autoComplete="new-password" {...form.getInputProps('new_password')} />
          <PasswordInput label="Repeat new password" autoComplete="new-password" {...form.getInputProps('confirm')} />
        </Stack>
        <ModalButtons onClose={onClose} loading={save.isPending} label="Change" />
      </form>
    </Modal>
  )
}

function DeleteAccountModal({ onClose }) {
  const { logout } = useAuth()
  const form = useForm({ initialValues: { password: '' } })
  const remove = useSave((values) => api.delete('/auth/me/', { data: values }), { notifyErrors: false })
  return (
    <Modal opened onClose={onClose} title="Delete account">
      <form onSubmit={form.onSubmit((values) =>
        remove.mutate(values, { onSuccess: logout, onError: (error) => form.setErrors(fieldErrors(error)) }))}>
        <Stack>
          <Text size="sm">
            This permanently deletes your account, every home, lease, payment, meter reading and uploaded file.
            It cannot be undone.
          </Text>
          <PasswordInput label="Your password" {...form.getInputProps('password')} />
        </Stack>
        <ModalButtons onClose={onClose} loading={remove.isPending} label="Delete everything" color="red" />
      </form>
    </Modal>
  )
}

export default function AccountPage() {
  const { user } = useAuth()
  const [modal, setModal] = useState(null) // 'name' | 'password' | 'delete'
  const close = () => setModal(null)
  const fullName = [user.last_name, user.first_name].filter(Boolean).join(' ')
  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="mr-split" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
      <Panel title="Info about me">
        <Stack gap={14}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={14}>
            <div className="mr-tile" style={{ display: 'grid', placeItems: 'center', minHeight: 150 }}>
              <Avatar size={110} radius={110} color="rose.7" variant="filled" fz={36}>{initials || '?'}</Avatar>
            </div>
            <Tile tone="dark" label="First and second name" value={fullName} onEdit={() => setModal('name')} />
          </SimpleGrid>
          <Tile label="Email" value={user.email} sub="Used to log in and for reminder emails" />
          <Tile label="Password" value="•••••••••" onEdit={() => setModal('password')} editLabel="Change" />
        </Stack>
      </Panel>

      <Panel title="Privacy and data">
        <div className="mr-tile">
          <List size="sm" spacing={8} c="var(--mr-dark)">
            <List.Item>Your name and email, to log you in and send reminders.</List.Item>
            <List.Item>What you enter about your home: address, landlord contacts, lease terms, payments, meter readings.</List.Item>
            <List.Item>Files you upload. Photos are saved without location data; files open only through private links that expire after 10 minutes.</List.Item>
          </List>
          <Text size="sm" mt="md" c="dimmed">
            Only you can see your data. You agreed to these terms on{' '}
            {user.consent_given_at ? new Date(user.consent_given_at).toLocaleDateString('ru-RU') : '—'}.
          </Text>
        </div>
        <div className="mr-tile" style={{ marginTop: 14 }}>
          <Text fw={600}>Delete account</Text>
          <Text size="sm" c="dimmed" mb="md">Removes your account and all your data and files.</Text>
          <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={() => setModal('delete')}>
            Delete my account
          </Button>
        </div>
      </Panel>

      {modal === 'name' && <NameModal onClose={close} />}
      {modal === 'password' && <PasswordModal onClose={close} />}
      {modal === 'delete' && <DeleteAccountModal onClose={close} />}
    </div>
  )
}
