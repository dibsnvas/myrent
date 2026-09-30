import { Alert, Anchor, Button, Checkbox, PasswordInput, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { errorMessage, fieldErrors } from '../api/client'
import { useAuth } from '../auth/useAuth'
import AuthLayout from './AuthLayout'

export default function RegisterPage() {
  const { register } = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const form = useForm({
    initialValues: { first_name: '', last_name: '', email: '', password: '', consent: false },
    validate: {
      first_name: (value) => (value.trim() ? null : 'Enter your first name'),
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email'),
      password: (value) => (value.length >= 8 ? null : 'At least 8 characters'),
      consent: (value) => (value ? null : 'Needed to create an account'),
    },
  })

  const onSubmit = async (values) => {
    setError('')
    setSubmitting(true)
    try {
      await register(values) // lands on "/", which shows "Add the home you rent" for a new account
    } catch (err) {
      const errors = fieldErrors(err)
      if (Object.keys(errors).length) form.setErrors(errors)
      else setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Create your account">
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack>
          {error && <Alert color="red">{error}</Alert>}
          <SimpleGrid cols={2}>
            <TextInput label="First name" autoComplete="given-name" {...form.getInputProps('first_name')} />
            <TextInput label="Last name" description="Optional" autoComplete="family-name"
              {...form.getInputProps('last_name')} />
          </SimpleGrid>
          <TextInput label="Email" type="email" autoComplete="email" {...form.getInputProps('email')} />
          <PasswordInput label="Password" description="At least 8 characters, not only numbers"
            autoComplete="new-password" {...form.getInputProps('password')} />
          <Checkbox
            {...form.getInputProps('consent', { type: 'checkbox' })}
            label={
              <Text size="sm">
                I agree that MyRent stores the data I enter (my name, email, rental records and files) only to run
                my account. Only I can see it, and I can delete my account with all data at any time.
              </Text>
            }
          />
          <Button type="submit" loading={submitting} fullWidth>
            Create account
          </Button>
          <Text size="sm" ta="center">
            Already have an account?{' '}
            <Anchor component={Link} to="/login">
              Log in
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  )
}
