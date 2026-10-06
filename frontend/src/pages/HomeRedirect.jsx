import { Navigate } from 'react-router-dom'

import { useProperties } from '../api/queries'
import { QueryState } from '../components/common'
import { LAST_HOME_KEY } from '../components/Layout'
import { EmptyAdd, Panel } from '../components/ui'

function lastHome() {
  try {
    return localStorage.getItem(LAST_HOME_KEY)
  } catch {
    return null
  }
}

/** "/" opens the home the tenant used last, or the empty "Add data about rent" screen. */
export default function HomeRedirect() {
  const homes = useProperties()
  return (
    <QueryState query={homes}>
      {(list) => {
        if (!list.length) {
          return (
            <Panel>
              <EmptyAdd to="/homes/new">Add data about rent</EmptyAdd>
            </Panel>
          )
        }
        const remembered = list.find((home) => String(home.id) === lastHome())
        return <Navigate to={`/homes/${(remembered ?? list[0]).id}`} replace />
      }}
    </QueryState>
  )
}
