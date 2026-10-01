import { Center, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core'
import { IconBuildingCommunity, IconHome, IconKey } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import { useSave } from '../api/queries'
import { useAuth } from '../auth/useAuth'

const ROLES = [
  {
    role: 'tenant',
    icon: IconKey,
    title: 'I rent a home',
    text: 'Keep your lease, rent, bills, meter readings and move-in photos in one place, and get reminded before every payment.',
  },
  {
    role: 'landlord',
    icon: IconBuildingCommunity,
    title: 'I rent out a home',
    text: 'See all your properties, which tenants have paid this month, who is late and which leases end soon.',
  },
]

/** Shown once, right after sign-up: the answer decides what the user sees first. */
export default function WelcomePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const choose = useSave((role) => api.patch('/auth/me/', { role }))

  const pick = (role) =>
    choose.mutate(role, {
      onSuccess: ({ data }) => {
        setUser(data)
        navigate('/', { replace: true })
      },
    })

  return (
    <Center mih="100vh" p="md">
      <Stack w="100%" maw={760} gap="xl">
        <Stack align="center" gap={6} ta="center">
          <Group gap={8}>
            <ThemeIcon size={36} radius="md">
              <IconHome size={22} />
            </ThemeIcon>
            <Text fw={800} size="xl">
              MyRent
            </Text>
          </Group>
          <Title order={2} mt="md">
            Welcome{user?.first_name ? `, ${user.first_name}` : ''}! How will you use MyRent?
          </Title>
          <Text c="dimmed" size="sm">
            This decides what you see first. You can change it any time in Account.
          </Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {ROLES.map(({ role, icon: Icon, title, text }) => (
            <UnstyledButton
              key={role}
              onClick={() => pick(role)}
              disabled={choose.isPending}
              aria-label={title}
              style={{ height: '100%' }}
            >
              <Paper withBorder radius="lg" p="xl" h="100%" className="role-card">
                <Stack gap="sm">
                  <ThemeIcon size={48} radius="md" variant="light">
                    <Icon size={28} />
                  </ThemeIcon>
                  <Text fw={700} size="lg">
                    {title}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {text}
                  </Text>
                  <Text size="sm" fw={600} c="teal">
                    {choose.isPending && choose.variables === role ? 'Saving…' : 'Choose →'}
                  </Text>
                </Stack>
              </Paper>
            </UnstyledButton>
          ))}
        </SimpleGrid>
      </Stack>
    </Center>
  )
}
