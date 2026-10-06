import { Center, Loader } from '@mantine/core'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/useAuth'
import Layout from './components/Layout'
import AccountPage from './pages/AccountPage'
import CalendarPage from './pages/CalendarPage'
import ConditionPage from './pages/ConditionPage'
import ContractPage from './pages/ContractPage'
import DashboardPage from './pages/DashboardPage'
import HelpPage from './pages/HelpPage'
import HomeRedirect from './pages/HomeRedirect'
import LoginPage from './pages/LoginPage'
import NewHomePage from './pages/NewHomePage'
import PaymentsPage from './pages/PaymentsPage'
import RegisterPage from './pages/RegisterPage'
import UtilitiesPage from './pages/UtilitiesPage'

function FullPageLoader() {
  return (
    <Center h="100vh">
      <Loader />
    </Center>
  )
}

function RequireAuth({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageLoader />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

/** Login and sign-up pages. Once logged in, go back to where the user was headed (or "/"). */
function PublicOnly({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageLoader />
  if (status === 'authenticated') return <Navigate to={location.state?.from ?? '/'} replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<HomeRedirect />} />
        <Route path="homes/new" element={<NewHomePage />} />
        <Route path="homes/:homeId" element={<DashboardPage />} />
        <Route path="homes/:homeId/contract" element={<ContractPage />} />
        <Route path="homes/:homeId/payments" element={<PaymentsPage />} />
        <Route path="homes/:homeId/utilities" element={<UtilitiesPage />} />
        <Route path="homes/:homeId/calendar" element={<CalendarPage />} />
        <Route path="homes/:homeId/condition" element={<ConditionPage />} />
        <Route path="homes/:homeId/condition/:stage" element={<ConditionPage />} />
        <Route path="homes/:homeId/documents" element={<Navigate to="../condition" relative="path" replace />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
