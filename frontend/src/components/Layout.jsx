import { ActionIcon, Autocomplete, Avatar, Burger, Drawer, Indicator, Popover, Select, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBell,
  IconBolt,
  IconCalendarEvent,
  IconCreditCard,
  IconFileText,
  IconHelpCircle,
  IconLayoutDashboard,
  IconLogout,
  IconPhoto,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react'
import { useEffect } from 'react'
import { Link, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'

import { useProperties, useReminders } from '../api/queries'
import { useAuth } from '../auth/useAuth'
import { formatDate } from '../lib/format'

export const LAST_HOME_KEY = 'myrent.lastHome'

const HOME_LINKS = [
  { path: '', label: 'Dashboard', icon: IconLayoutDashboard },
  { path: '/contract', label: 'Contract', icon: IconFileText },
  { path: '/payments', label: 'Payments', icon: IconCreditCard },
  { path: '/utilities', label: 'Utilities and meters', icon: IconBolt },
  { path: '/calendar', label: 'Calendar and reminders', icon: IconCalendarEvent },
  { path: '/condition', label: 'Housing condition', icon: IconPhoto },
]

function rememberedHome() {
  try {
    return localStorage.getItem(LAST_HOME_KEY)
  } catch {
    return null
  }
}

function initials(user) {
  return `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || '?'
}

function Sidebar({ homeId, onNavigate }) {
  const { logout } = useAuth()
  const location = useLocation()
  const base = homeId ? `/homes/${homeId}` : null
  return (
    <nav className="mr-sidebar" aria-label="Main menu">
      <Link to="/" className="mr-logo" onClick={onNavigate}>
        <div className="mr-logo-name">MyRent</div>
        <div className="mr-logo-tag">super app for rental</div>
      </Link>
      <div className="mr-nav-label">Menu</div>
      {HOME_LINKS.map(({ path, label, icon: Icon }) => {
        const to = base ? `${base}${path}` : '/'
        const active = base && (path ? location.pathname.startsWith(to) : location.pathname === base)
        return (
          <Link key={label} to={to} className="mr-nav-item" data-active={active || undefined} onClick={onNavigate}>
            <Icon size={19} stroke={1.6} />
            {label}
          </Link>
        )
      })}
      <Link to="/homes/new" className="mr-nav-item" data-active={location.pathname === '/homes/new' || undefined}
        onClick={onNavigate}>
        <IconPlus size={19} stroke={1.6} />
        Add a rent
      </Link>
      <div className="mr-nav-label" style={{ marginTop: 'auto' }}>General</div>
      <Link to="/help" className="mr-nav-item" data-active={location.pathname === '/help' || undefined} onClick={onNavigate}>
        <IconHelpCircle size={19} stroke={1.6} />
        Help
      </Link>
      <button type="button" className="mr-nav-item" onClick={logout}>
        <IconLogout size={19} stroke={1.6} />
        Log out
      </button>
    </nav>
  )
}

function Reminders() {
  const reminders = useReminders()
  const list = reminders.data ?? []
  return (
    <Popover position="bottom-end" width={320} shadow="md">
      <Popover.Target>
        <Indicator disabled={!list.length} label={list.length} size={16} color="rose.7" offset={4}>
          <ActionIcon variant="subtle" color="rose.7" size="lg" radius="xl" aria-label="Reminders">
            <IconBell size={22} stroke={1.6} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown bg="var(--mr-bg)">
        <Text fw={700} mb="xs">Reminders</Text>
        {list.length ? (
          <Stack gap={8}>
            {list.map((reminder) => (
              <div key={reminder.key}>
                <Text size="sm" fw={600} c={reminder.level === 'overdue' ? 'var(--mr-danger)' : undefined}>
                  {reminder.title}
                </Text>
                <Text size="xs" c="dimmed">{formatDate(reminder.date)} · {reminder.property_title}</Text>
              </div>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">Nothing to worry about right now.</Text>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}

export default function Layout() {
  const [drawerOpened, { toggle, close }] = useDisclosure()
  const { user } = useAuth()
  const { data: homes = [] } = useProperties()
  const navigate = useNavigate()
  const location = useLocation()
  const match = useMatch('/homes/:homeId/*')
  const urlHome = match && /^\d+$/.test(match.params.homeId) ? match.params.homeId : null
  const remembered = homes.find((home) => String(home.id) === rememberedHome())
  const homeId = urlHome ?? (remembered ?? homes[0])?.id ?? null

  useEffect(() => {
    if (!urlHome) return
    try {
      localStorage.setItem(LAST_HOME_KEY, urlHome)
    } catch {
      // private mode: remembering the last home is only a convenience
    }
  }, [urlHome])

  const searchOptions = [
    ...HOME_LINKS.map((link) => link.label),
    'Account',
    'Help',
    ...homes.map((home) => `Home: ${home.title}`),
  ]
  const goTo = (value) => {
    if (value.startsWith('Home: ')) {
      const home = homes.find((item) => `Home: ${item.title}` === value)
      if (home) navigate(`/homes/${home.id}`)
      return
    }
    if (value === 'Account') return navigate('/account')
    if (value === 'Help') return navigate('/help')
    const link = HOME_LINKS.find((item) => item.label === value)
    if (link && homeId) navigate(`/homes/${homeId}${link.path}`)
  }

  const switchHome = (id) => {
    const section = HOME_LINKS.find((link) => link.path && location.pathname.includes(link.path))?.path ?? ''
    navigate(`/homes/${id}${section}`)
  }

  return (
    <div className="mr-shell">
      <Sidebar homeId={homeId} />
      <Drawer opened={drawerOpened} onClose={close} size={280} padding={0} withCloseButton={false}
        styles={{ body: { padding: 12, background: 'var(--mr-bg)', height: '100%' } }}>
        <Sidebar homeId={homeId} onNavigate={close} />
      </Drawer>

      <div className="mr-main">
        <header className="mr-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <Burger opened={drawerOpened} onClick={toggle} size="sm" className="mr-burger" aria-label="Menu" />
            <Autocomplete
              placeholder="Search"
              data={searchOptions}
              rightSection={<IconSearch size={16} />}
              w={{ base: '100%', sm: 260 }}
              maw={260}
              onOptionSubmit={goTo}
              comboboxProps={{ radius: 'lg' }}
              aria-label="Search pages"
            />
            {homes.length > 1 && (
              <Select
                aria-label="Home"
                data={homes.map((home) => ({ value: String(home.id), label: home.title }))}
                value={homeId ? String(homeId) : null}
                onChange={(id) => id && switchHome(id)}
                allowDeselect={false}
                w={190}
                visibleFrom="sm"
              />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Reminders />
            <Link to="/account" className="mr-user">
              <Avatar radius="xl" color="rose.7" variant="filled" size={38}>{initials(user)}</Avatar>
              <div style={{ minWidth: 0 }} className="mr-user-text">
                <Text size="sm" fw={600} truncate>{[user?.first_name, user?.last_name].filter(Boolean).join(' ')}</Text>
                <Text size="xs" c="dimmed" truncate>{user?.email}</Text>
              </div>
            </Link>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
