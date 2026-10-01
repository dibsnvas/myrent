import { Alert, Badge, Button, Center, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { IconAlertTriangle, IconBell, IconClockExclamation, IconInfoCircle } from '@tabler/icons-react'

import { errorMessage } from '../api/client'
import { formatDate, formatMoney, PAYMENT_STATUS, REMINDER_LEVEL } from '../lib/format'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" gap="sm">
      <div>
        <Title order={2}>{title}</Title>
        {subtitle && (
          <Text c="dimmed" size="sm" mt={4}>
            {subtitle}
          </Text>
        )}
      </div>
      {actions && <Group gap="xs">{actions}</Group>}
    </Group>
  )
}

/** Loading spinner, error with retry, or the content. */
export function QueryState({ query, children }) {
  if (query.isPending) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    )
  }
  if (query.isError) {
    return (
      <Alert color="red" icon={<IconAlertTriangle />} title="Could not load this page">
        <Stack gap="xs" align="flex-start">
          <Text size="sm">{errorMessage(query.error)}</Text>
          <Button size="xs" variant="light" color="red" onClick={() => query.refetch()}>
            Try again
          </Button>
        </Stack>
      </Alert>
    )
  }
  return children(query.data)
}

export function StatusBadge({ status }) {
  const { color, label } = PAYMENT_STATUS[status] ?? { color: 'gray', label: status }
  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  )
}

const LEVEL_ICON = { overdue: IconClockExclamation, soon: IconBell, info: IconInfoCircle }

export function ReminderList({ reminders }) {
  if (!reminders.length) return null
  return (
    <Stack gap="xs" mb="lg">
      {reminders.map((reminder) => {
        const Icon = LEVEL_ICON[reminder.level]
        return (
          <Alert key={reminder.key} color={REMINDER_LEVEL[reminder.level].color} icon={<Icon size={20} />} py="xs">
            <Group justify="space-between" gap="xs">
              <Text size="sm" fw={500}>
                {reminder.title}
                {reminder.amount && ` · ${formatMoney(reminder.amount)}`}
              </Text>
              <Text size="sm" c="dimmed">
                {formatDate(reminder.date)}
              </Text>
            </Group>
          </Alert>
        )
      })}
    </Stack>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <Stack align="center" gap="xs" py="xl" ta="center">
      {Icon && <Icon size={40} stroke={1.3} color="var(--mantine-color-gray-5)" />}
      <Text fw={600}>{title}</Text>
      {text && (
        <Text c="dimmed" size="sm" maw={420}>
          {text}
        </Text>
      )}
      {action}
    </Stack>
  )
}
