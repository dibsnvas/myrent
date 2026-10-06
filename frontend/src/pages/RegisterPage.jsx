import { Alert, Button, Checkbox, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconMail, IconPencil } from '@tabler/icons-react'
import { useState } from 'react'

import { errorMessage, fieldErrors } from '../api/client'
import { useAuth } from '../auth/useAuth'
import AuthLayout from './AuthLayout'

const pencil = <IconPencil size={16} color="var(--mr-muted)" />

export default function RegisterPage() {
  const { register } = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const form = useForm({
    initialValues: { first_name: '', last_name: '', email: '', password: '', confirm: '', consent: false },
    validate: {
      first_name: (value) => (value.trim() ? null : 'Enter your name'),
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email'),
      password: (value) => (value.length >= 8 ? null : 'At least 8 characters, not only numbers'),
      confirm: (value, values) => (value === values.password ? null : 'Passwords do not match'),
      consent: (value) => (value ? null : 'Needed to create an account'),
    },
  })

  const onSubmit = async ({ confirm: _confirm, ...values }) => {
    setError('')
    setSubmitting(true)
    try {
      await register(values) // lands on "/", which shows "Add data about rent" for a new account
    } catch (err) {
      const errors = fieldErrors(err)
      if (Object.keys(errors).length) form.setErrors(errors)
      else setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout mode="register">
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="sm">
          {error && <Alert color="red" radius="lg">{error}</Alert>}
          <TextInput aria-label="Name" placeholder="Name *" autoComplete="given-name" rightSection={pencil}
            {...form.getInputProps('first_name')} />
          <TextInput aria-label="Surname" placeholder="Surname" autoComplete="family-name" rightSection={pencil}
            {...form.getInputProps('last_name')} />
          <TextInput aria-label="Email" placeholder="Email *" type="email" autoComplete="email"
            rightSection={<IconMail size={16} color="var(--mr-muted)" />} {...form.getInputProps('email')} />
          <PasswordInput aria-label="Password" placeholder="Password *" autoComplete="new-password"
            {...form.getInputProps('password')} />
          <PasswordInput aria-label="Confirm password" placeholder="Confirm password *" autoComplete="new-password"
            {...form.getInputProps('confirm')} />
          <Checkbox
            mt={4}
            color="rose.7"
            {...form.getInputProps('consent', { type: 'checkbox' })}
            label={
              <>
                <Text size="sm">I agree with the app's data policy</Text>
                <Text size="xs" c="dimmed">
                  MyRent stores your name, email, rental records and files only to run your account. Only you can
                  see them, and you can delete everything at any time.
                </Text>
              </>
            }
          />
          <Button type="submit" loading={submitting} fullWidth size="md" mt="xs">
            Sign up
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  )
}
