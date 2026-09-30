import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { Link } from 'react-router-dom'

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
    <AuthLayout title="Log in">
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack>
          {error && <Alert color="red">{error}</Alert>}
          <TextInput label="Email" type="email" autoComplete="email" {...form.getInputProps('email')} />
          <PasswordInput label="Password" autoComplete="current-password" {...form.getInputProps('password')} />
          <Button type="submit" loading={submitting} fullWidth>
            Log in
          </Button>
          <Text size="sm" ta="center">
            New here?{' '}
            <Anchor component={Link} to="/register">
              Create an account
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  )
}
