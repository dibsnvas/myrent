import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconMail } from '@tabler/icons-react'
import { useState } from 'react'

import { errorMessage } from '../api/client'
import { useAuth } from '../auth/useAuth'
import AuthLayout from './AuthLayout'

export default function LoginPage() {
  const { login } = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter your email'),
      password: (value) => (value ? null : 'Enter your password'),
    },
  })

  const onSubmit = async ({ email, password }) => {
    setError('')
    setSubmitting(true)
    try {
      await login(email, password) // PublicOnly in App.jsx redirects once logged in
    } catch (err) {
      setError(err.response?.status === 401 ? 'Wrong email or password.' : errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout mode="login">
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="sm">
          {error && <Alert color="red" radius="lg">{error}</Alert>}
          <TextInput aria-label="Email" placeholder="Email *" type="email" autoComplete="email"
            rightSection={<IconMail size={16} color="var(--mr-muted)" />} {...form.getInputProps('email')} />
          <PasswordInput aria-label="Password" placeholder="Password *" autoComplete="current-password"
            {...form.getInputProps('password')} />
          <Button type="submit" loading={submitting} fullWidth size="md" mt="sm">
            Login
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  )
}
