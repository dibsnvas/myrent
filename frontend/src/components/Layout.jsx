import { AppShell, Burger, Group, Menu, NavLink, Select, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBolt,
  IconBuildingCommunity,
  IconCalendarDollar,
  IconChevronDown,
  IconFiles,
  IconHome,
  IconLayoutDashboard,
  IconLogout,
  IconPlus,
  IconUser,
} from '@tabler/icons-react'
import { useEffect } from 'react'
import { Link, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'

import { useProperties } from '../api/queries'
import { useAuth } from '../auth/useAuth'
import { useCopy } from '../auth/useCopy'

export const LAST_HOME_KEY = 'myrent.lastHome'

const HOME_LINKS = [
  { path: '', label: 'Dashboard', icon: IconLayoutDashboard },
  { path: '/payments', label: 'Payments & calendar', icon: IconCalendarDollar },
  { path: '/utilities', label: 'Utilities & meters', icon: IconBolt },
  { path: '/documents', label: 'Documents & photos', icon: IconFiles },
]

export default function Layout() {
  const [navOpened, { toggle, close }] = useDisclosure()
  const { user, logout } = useAuth()
  const copy = useCopy()
  const isLandlord = user?.role === 'landlord'
  const { data: homes = [] } = useProperties()
  const navigate = useNavigate()
  const location = useLocation()
  const match = useMatch('/homes/:homeId/*')
  const homeId = match && /^\d+$/.test(match.params.homeId) ? match.params.homeId : null

  useEffect(() => {
    if (!homeId) return
    try {
      localStorage.setItem(LAST_HOME_KEY, homeId)
    } catch {
      // private mode: remembering the last home is only a convenience
    }
  }, [homeId])

  const switchHome = (id) => {
    if (!id) return
    const section = HOME_LINKS.find((link) => link.path && location.pathname.endsWith(link.path))?.path ?? ''
    navigate(`/homes/${id}${section}`)
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={navOpened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
            <UnstyledButton component={Link} to="/">
              <Group gap={8} wrap="nowrap">
                <ThemeIcon size={30} radius="md">
                  <IconHome size={18} />
                </ThemeIcon>
                <Text fw={700} size="lg" visibleFrom="xs">
                  MyRent
                </Text>
              </Group>
            </UnstyledButton>
            {homes.length > 0 && (
              <Select
                aria-label="Home"
                w={{ base: 150, sm: 220 }}
                data={homes.map((home) => ({ value: String(home.id), label: home.title }))}
                value={homeId}
                placeholder={copy.choosePlaceholder}
                onChange={switchHome}
                allowDeselect={false}
              />
            )}
          </Group>
          <Menu position="bottom-end" width={200}>
            <Menu.Target>
              <UnstyledButton>
                <Group gap={4} wrap="nowrap">
                  <Text size="sm" fw={500}>
                    {user?.first_name}
                  </Text>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconUser size={16} />} component={Link} to="/account">
                Account & privacy
              </Menu.Item>
              <Menu.Item leftSection={<IconLogout size={16} />} onClick={logout}>
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {isLandlord && (
          <NavLink
            component={Link}
            to="/"
            label="All properties"
            leftSection={<IconBuildingCommunity size={18} />}
            active={location.pathname === '/'}
            onClick={close}
            mb={homeId ? 'xs' : 0}
          />
        )}
        {homeId &&
          HOME_LINKS.map(({ path, label, icon: Icon }) => {
            const to = `/homes/${homeId}${path}`
            return (
              <NavLink
                key={label}
                component={Link}
                to={to}
                label={label}
                leftSection={<Icon size={18} />}
                active={location.pathname === to}
                onClick={close}
              />
            )
          })}
        <NavLink
          component={Link}
          to="/homes/new"
          label={copy.addHome}
          leftSection={<IconPlus size={18} />}
          active={location.pathname === '/homes/new'}
          onClick={close}
          mt={homeId ? 'md' : 0}
        />
        <NavLink
          component={Link}
          to="/account"
          label="Account & privacy"
          leftSection={<IconUser size={18} />}
          active={location.pathname === '/account'}
          onClick={close}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
