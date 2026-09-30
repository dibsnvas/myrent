import { Center, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconHome } from '@tabler/icons-react'

export default function AuthLayout({ title, children }) {
  return (
    <Center mih="100vh" p="md">
      <Stack w="100%" maw={420} gap="lg">
        <Stack align="center" gap={6}>
          <Group gap={8}>
            <ThemeIcon size={36} radius="md">
              <IconHome size={22} />
            </ThemeIcon>
            <Text fw={800} size="xl">
              MyRent
            </Text>
          </Group>
          <Text c="dimmed" size="sm" ta="center">
            Your lease, rent, bills, meters and move-in photos in one place.
          </Text>
        </Stack>
        <Paper withBorder shadow="sm" p="xl" radius="lg">
          <Title order={3} mb="md">
            {title}
          </Title>
          {children}
        </Paper>
      </Stack>
    </Center>
  )
}
