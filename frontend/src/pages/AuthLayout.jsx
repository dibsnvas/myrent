import { SegmentedControl, Text, Title } from '@mantine/core'
import { useNavigate } from 'react-router-dom'

/** Login and sign-up share this card: title, "join us" line and the Login | Sign Up switch. */
export default function AuthLayout({ mode, children }) {
  const navigate = useNavigate()
  return (
    <div className="mr-auth-bg">
      <div className="mr-auth-card">
        <Title order={2} ta="center" fz={26} fw={800}>
          {mode === 'login' ? 'Login to MyRent' : 'Sign up to MyRent'}
        </Title>
        <Text ta="center" size="sm" c="dimmed" mb="lg">
          Your lease, rent, bills and meters in one place
        </Text>
        <SegmentedControl
          fullWidth
          radius="xl"
          mb="lg"
          value={mode}
          onChange={(value) => navigate(value === 'login' ? '/login' : '/register', { replace: true })}
          data={[
            { value: 'login', label: 'Login' },
            { value: 'register', label: 'Sign Up' },
          ]}
          styles={{
            root: { backgroundColor: 'var(--mr-muted)' },
            indicator: { backgroundColor: 'var(--mr-dark)' },
            label: { color: 'var(--mr-bg)', fontWeight: 500 },
          }}
        />
        {children}
      </div>
    </div>
  )
}
