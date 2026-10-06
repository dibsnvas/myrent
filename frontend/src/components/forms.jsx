/** Field groups shared by the "add a home" wizard and the edit modals. Each takes a Mantine form. */
import { NumberInput, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'

import { PROPERTY_TYPES } from '../lib/format'

/** Layout of the "Address and landlord" step in the Figma: three columns of pill inputs. */
export function HomeFields({ form, showMeterDay = true }) {
  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TextInput label="Name of rent" placeholder="Ex., Flat on Abay" withAsterisk {...form.getInputProps('title')} />
        <Select label="Type of rent" data={PROPERTY_TYPES} allowDeselect={false} {...form.getInputProps('property_type')} />
        <TextInput label="Address of rent" placeholder="Ex., Tole bi 59, apt 12" withAsterisk
          {...form.getInputProps('address')} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TextInput label="Landlord name" placeholder="Ex., Serik K." {...form.getInputProps('landlord_name')} />
        <TextInput label="Landlord phone" placeholder="+7 7__ ___ __ __" {...form.getInputProps('landlord_phone')} />
        <TextInput label="Landlord email" type="email" {...form.getInputProps('landlord_email')} />
      </SimpleGrid>
      {showMeterDay && (
        <NumberInput
          label="Meter readings are due on day"
          description="Leave empty if meters are not read every month"
          min={1}
          max={28}
          allowDecimal={false}
          w={{ base: '100%', sm: 300 }}
          {...form.getInputProps('meter_reading_day')}
        />
      )}
      <Textarea label="Notes" placeholder="Key, intercom code or something else" autosize minRows={1}
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
        label="Notes"
        placeholder="Who pays for utilities, rules about rent and other"
        autosize
        minRows={2}
        {...form.getInputProps('terms')}
      />
    </Stack>
  )
}
