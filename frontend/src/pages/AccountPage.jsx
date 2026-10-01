import {
  Button,
  Card,
  Group,
  List,
  Modal,
  PasswordInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'

import { api, fieldErrors } from '../api/client'
import { useSave } from '../api/queries'
import { useAuth } from '../auth/useAuth'
import { PageHeader } from '../components/common'

function DeleteAccountModal({ onClose }) {
  const { logout } = useAuth()
  const form = useForm({ initialValues: { password: '' } })
  const remove = useSave((values) => api.delete('/auth/me/', { data: values }), { notifyErrors: false })
  return (
    <Modal opened onClose={onClose} title="Delete account">
      <form
        onSubmit={form.onSubmit((values) =>
          remove.mutate(values, { onSuccess: logout, onError: (error) => form.setErrors(fieldErrors(error)) }),
        )}
      >
        <Stack>
          <Text size="sm">
            This permanently deletes your account, every home, lease, payment, meter reading and uploaded file.
            It cannot be undone.
          </Text>
          <PasswordInput label="Your password" {...form.getInputProps('password')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button color="red" type="submit" loading={remove.isPending}>Delete everything</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

const ROLE_OPTIONS = [
  { value: 'tenant', label: 'I rent a home' },
  { value: 'landlord', label: 'I rent out a home' },
]

export default function AccountPage() {
  const { user, setUser } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const changeRole = useSave((role) => api.patch('/auth/me/', { role }), { success: 'Saved' })
  const form = useForm({ initialValues: { first_name: user.first_name, last_name: user.last_name } })
  const save = useSave((values) => api.patch('/auth/me/', values), { success: 'Profile saved' })

  return (
    <>
      <PageHeader title="Account & privacy" />
      <Stack maw={760}>
        <Card withBorder padding="lg">
          <Title order={4} mb="md">Profile</Title>
          <form onSubmit={form.onSubmit((values) => save.mutate(values, { onSuccess: ({ data }) => setUser(data) }))}>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="First name" {...form.getInputProps('first_name')} />
              <TextInput label="Last name" {...form.getInputProps('last_name')} />
            </SimpleGrid>
            <TextInput label="Email" value={user.email} disabled mt="md" />
            <Group justify="flex-end" mt="md">
              <Button type="submit" loading={save.isPending}>Save</Button>
            </Group>
          </form>
        </Card>

        <Card withBorder padding="lg">
          <Title order={4} mb={4}>How you use MyRent</Title>
          <Text size="sm" c="dimmed" mb="md">
            Changes what you see first and the wording (landlord or tenant). Your data stays the same.
          </Text>
          <SegmentedControl
            data={ROLE_OPTIONS}
            value={user.role ?? 'tenant'}
            disabled={changeRole.isPending}
            onChange={(role) => changeRole.mutate(role, { onSuccess: ({ data }) => setUser(data) })}
          />
        </Card>

        <Card withBorder padding="lg">
          <Title order={4} mb="sm">What MyRent stores</Title>
          <List size="sm" spacing={6}>
            <List.Item>Your name and email, to log you in and send reminders.</List.Item>
            <List.Item>What you enter about your homes: address, landlord or tenant contacts, lease terms, payments, meter readings.</List.Item>
            <List.Item>Files you upload. Photos are saved without location data. Files open only through short-lived private links.</List.Item>
          </List>
          <Text size="sm" mt="sm" c="dimmed">
            Only you can see your data. You agreed to these terms on{' '}
            {user.consent_given_at ? new Date(user.consent_given_at).toLocaleDateString('ru-RU') : '—'}.
          </Text>
        </Card>

        <Card withBorder padding="lg" style={{ borderColor: 'var(--mantine-color-red-3)' }}>
          <Title order={4} mb="xs">Delete account</Title>
          <Text size="sm" c="dimmed" mb="md">Removes your account and all your data and files.</Text>
          <Button color="red" variant="light" w="fit-content" leftSection={<IconTrash size={16} />} onClick={() => setDeleting(true)}>
            Delete my account
          </Button>
        </Card>
      </Stack>
      {deleting && <DeleteAccountModal onClose={() => setDeleting(false)} />}
    </>
  )
}
