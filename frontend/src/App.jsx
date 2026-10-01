import { Center, Loader } from '@mantine/core'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/useAuth'
import Layout from './components/Layout'
import AccountPage from './pages/AccountPage'
import DashboardPage from './pages/DashboardPage'
import DocumentsPage from './pages/DocumentsPage'
import HomeRedirect from './pages/HomeRedirect'
import LoginPage from './pages/LoginPage'
import NewHomePage from './pages/NewHomePage'
import PaymentsPage from './pages/PaymentsPage'
import PortfolioPage from './pages/PortfolioPage'
import RegisterPage from './pages/RegisterPage'
import UtilitiesPage from './pages/UtilitiesPage'
import WelcomePage from './pages/WelcomePage'

function FullPageLoader() {
  return (
    <Center h="100vh">
      <Loader />
    </Center>
  )
}

function RequireAuth({ children }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageLoader />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // A new account first answers "do you rent or rent out?" (onboarding).
  if (!user.role && location.pathname !== '/welcome') return <Navigate to="/welcome" replace />
  return children
}

/** "/": a landlord gets the portfolio of all properties, a tenant goes straight to their home. */
function Home() {
  const { user } = useAuth()
  return user.role === 'landlord' ? <PortfolioPage /> : <HomeRedirect />
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
      <Route path="/welcome" element={<RequireAuth><WelcomePage /></RequireAuth>} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="homes/new" element={<NewHomePage />} />
        <Route path="homes/:homeId" element={<DashboardPage />} />
        <Route path="homes/:homeId/payments" element={<PaymentsPage />} />
        <Route path="homes/:homeId/utilities" element={<UtilitiesPage />} />
        <Route path="homes/:homeId/documents" element={<DocumentsPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
