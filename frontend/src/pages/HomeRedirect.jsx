import { Button } from '@mantine/core'
import { IconHomePlus } from '@tabler/icons-react'
import { Link, Navigate } from 'react-router-dom'

import { useProperties } from '../api/queries'
import { useCopy } from '../auth/useCopy'
import { EmptyState, QueryState } from '../components/common'
import { LAST_HOME_KEY } from '../components/Layout'

function lastHome() {
  try {
    return localStorage.getItem(LAST_HOME_KEY)
  } catch {
    return null
  }
}

/** "/" opens the home the tenant used last, or onboarding if there is none yet. */
export default function HomeRedirect() {
  const copy = useCopy()
  const homes = useProperties()
  return (
    <QueryState query={homes}>
      {(list) => {
        if (!list.length) {
          return (
            <EmptyState
              icon={IconHomePlus}
              title={copy.emptyTitle}
              text={copy.emptyText}
              action={
                <Button component={Link} to="/homes/new" mt="sm">
                  {copy.addHome}
                </Button>
              }
            />
          )
        }
        const remembered = list.find((home) => String(home.id) === lastHome())
        return <Navigate to={`/homes/${(remembered ?? list[0]).id}`} replace />
      }}
    </QueryState>
  )
}
