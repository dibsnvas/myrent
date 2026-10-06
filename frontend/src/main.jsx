import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './styles.css'

import { createTheme, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { AuthProvider } from './auth/AuthContext'

// Karina's Figma palette ("dusty rose" + "creamy"), shades light -> dark; shade 7 is #574344.
const rose = ['#f8f4f1', '#efe7e3', '#ddcfcb', '#c8b5b2', '#a79797', '#8b7071', '#765c5d', '#574344', '#4a3839', '#3c2d2e']

const theme = createTheme({
  colors: { rose },
  primaryColor: 'rose',
  primaryShade: 7,
  black: '#574344',
  defaultRadius: 'xl',
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' },
  components: {
    Modal: { defaultProps: { radius: 24, centered: true, overlayProps: { backgroundOpacity: 0.35 } } },
    Menu: { defaultProps: { radius: 'lg' } },
    Popover: { defaultProps: { radius: 'lg' } },
  },
})

const cssVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': '#FDFDF1',
    '--mantine-color-text': '#574344',
    '--mantine-color-dimmed': '#A79797',
    '--mantine-color-default-border': '#DED8CC',
  },
  dark: {},
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light" cssVariablesResolver={cssVariablesResolver}>
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
)
