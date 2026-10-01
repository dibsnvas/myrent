import { Button } from '@mantine/core'
import { IconHomePlus } from '@tabler/icons-react'
import { Link, Navigate } from 'react-router-dom'

import { useProperties } from '../api/queries'
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
  const homes = useProperties()
  return (
    <QueryState query={homes}>
      {(list) => {
        if (!list.length) {
          return (
            <EmptyState
              icon={IconHomePlus}
              title="Add the home you rent"
              text="Start with the address and your lease. MyRent then builds your rent calendar and reminds you before every payment."
              action={
                <Button component={Link} to="/homes/new" mt="sm">
                  Add a home
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
