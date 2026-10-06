import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

import { errorMessage } from '../api/client'

/** Loading spinner, error with retry, or the content. */
export function QueryState({ query, children }) {
  if (query.isPending) {
    return (
      <Center py="xl">
        <Loader color="rose.7" />
      </Center>
    )
  }
  if (query.isError) {
    return (
      <Alert color="red" radius="lg" icon={<IconAlertTriangle />} title="Could not load this page">
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
