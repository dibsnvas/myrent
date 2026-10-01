/** Field groups shared by the "add a home" wizard and the edit modals. Each takes a Mantine form. */
import { NumberInput, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'

import { useCopy } from '../auth/useCopy'
import { PROPERTY_TYPES } from '../lib/format'

export function HomeFields({ form }) {
  const copy = useCopy()
  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput label="Name" placeholder={copy.namePlaceholder} withAsterisk {...form.getInputProps('title')} />
        <Select label="Type" data={PROPERTY_TYPES} allowDeselect={false} {...form.getInputProps('property_type')} />
      </SimpleGrid>
      <TextInput label="Address" placeholder="Street, building, apartment, city" withAsterisk
        {...form.getInputProps('address')} />
      <NumberInput
        label="Meter readings are due on day"
        description="Leave empty if meters are not read every month"
        min={1}
        max={28}
        allowDecimal={false}
        w={{ base: '100%', sm: 260 }}
        {...form.getInputProps('meter_reading_day')}
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TextInput label={copy.contactName} {...form.getInputProps('contact_name')} />
        <TextInput label={copy.contactPhone} placeholder="+7 7__ ___ __ __" {...form.getInputProps('contact_phone')} />
        <TextInput label={copy.contactEmail} type="email" {...form.getInputProps('contact_email')} />
      </SimpleGrid>
      <Textarea label="Notes" placeholder="Keys, intercom code, anything to remember" autosize minRows={2}
        {...form.getInputProps('notes')} />
    </Stack>
  )
}

export function LeaseFields({ form, hideStart = false }) {
  const onStartChange = (event) => {
    const start = event.currentTarget.value
    form.setFieldValue('start_date', start)
    // Most leases are paid on the day they start; days 29-31 don't exist in every month.
    if (start && !form.values.rent_due_day) form.setFieldValue('rent_due_day', Math.min(Number(start.slice(8)), 28))
  }
  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {!hideStart && (
          <TextInput label="Lease starts" type="date" withAsterisk {...form.getInputProps('start_date')}
            onChange={onStartChange} />
        )}
        <TextInput label="Lease ends" type="date" withAsterisk {...form.getInputProps('end_date')} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <NumberInput label="Monthly rent, ₸" withAsterisk min={0} thousandSeparator=" " hideControls
          {...form.getInputProps('monthly_rent')} />
        <NumberInput label="Rent due on day" withAsterisk min={1} max={28} allowDecimal={false}
          {...form.getInputProps('rent_due_day')} />
        <NumberInput label="Deposit, ₸" min={0} thousandSeparator=" " hideControls {...form.getInputProps('deposit')} />
      </SimpleGrid>
      <Textarea
        label="Key terms"
        placeholder="Who pays utilities, notice period, rules about rent increases..."
        autosize
        minRows={2}
        {...form.getInputProps('terms')}
      />
    </Stack>
  )
}
