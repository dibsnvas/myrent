import {
  Autocomplete,
  Button,
  Checkbox,
  FileInput,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconUpload } from '@tabler/icons-react'

import { api, fieldErrors } from '../api/client'
import { uploadDocument, useSave } from '../api/queries'
import { formatDate, formatMoney, isoDate, parseIso, todayIso, toApiNumber } from '../lib/format'
import {
  emptyLease,
  homeFromApi,
  homeToApi,
  homeValidation,
  leaseFromApi,
  leaseToApi,
  leaseValidation,
} from '../lib/formValues'
import { HomeFields, LeaseFields } from './forms'

export const FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

function ModalActions({ onClose, loading, label = 'Save' }) {
  return (
    <Group justify="flex-end" mt="lg">
      <Button variant="default" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" loading={loading}>
        {label}
      </Button>
    </Group>
  )
}

/** Runs `save`, and on a 400 puts the server's messages under the matching fields. */
function submitWith(form, mutation, onClose) {
  return form.onSubmit((values) =>
    mutation.mutate(values, {
      onSuccess: () => {
        form.reset()
        onClose()
      },
      onError: (error) => form.setErrors(fieldErrors(error)),
    }),
  )
}

export function EditHomeModal({ home, opened, onClose }) {
  const form = useForm({ initialValues: homeFromApi(home), validate: homeValidation })
  const save = useSave((values) => api.patch(`/properties/${home.id}/`, homeToApi(values)), { success: 'Home saved' })
  return (
    <Modal opened={opened} onClose={onClose} title="Edit home" size="lg">
      <form onSubmit={submitWith(form, save, onClose)}>
        <HomeFields form={form} />
        <ModalActions onClose={onClose} loading={save.isPending} />
      </form>
    </Modal>
  )
}

/** Create a lease (lease = null) or edit an existing one. Optional file goes in as a Document. */
export function LeaseModal({ homeId, lease, opened, onClose }) {
  const form = useForm({
    initialValues: { ...(lease ? leaseFromApi(lease) : emptyLease), file: null },
    validate: leaseValidation,
  })
  const save = useSave(
    async ({ file, ...values }) => {
      const payload = leaseToApi(values)
      if (file) payload.document = (await uploadDocument({ property: homeId, kind: 'lease', file })).id
      return lease
        ? api.patch(`/contracts/${lease.id}/`, payload)
        : api.post('/contracts/', { ...payload, property: homeId })
    },
    { success: lease ? 'Lease updated' : 'Lease added, rent schedule created' },
  )
  return (
    <Modal opened={opened} onClose={onClose} title={lease ? 'Edit lease' : 'Add lease'} size="lg">
      <form onSubmit={submitWith(form, save, onClose)}>
        <LeaseFields form={form} />
        <FileInput
          mt="md"
          label={lease?.document_file ? 'Replace lease file' : 'Lease file'}
          description="PDF up to 10 MB, or a photo up to 5 MB"
          accept={FILE_ACCEPT}
          leftSection={<IconUpload size={16} />}
          clearable
          {...form.getInputProps('file')}
        />
        <ModalActions onClose={onClose} loading={save.isPending} />
      </form>
    </Modal>
  )
}

export function RenewModal({ lease, opened, onClose }) {
  const dayAfterEnd = parseIso(lease.end_date)
  dayAfterEnd.setDate(dayAfterEnd.getDate() + 1)
  const form = useForm({
    initialValues: {
      ...leaseFromApi(lease),
      start_date: isoDate(dayAfterEnd),
      end_date: '',
      file: null,
    },
    validate: leaseValidation,
  })
  const save = useSave(
    async ({ file, ...values }) => {
      const payload = leaseToApi(values)
      if (file) payload.document = (await uploadDocument({ property: lease.property, kind: 'renewal', file })).id
      return api.post(`/contracts/${lease.id}/renew/`, payload)
    },
    { success: 'Renewal saved. The old lease is kept in history.' },
  )
  return (
    <Modal opened={opened} onClose={onClose} title="Renew lease" size="lg">
      <Text size="sm" c="dimmed" mb="md">
        Record the new period and any changed terms. The current lease and its payment history stay as they are.
      </Text>
      <form onSubmit={submitWith(form, save, onClose)}>
        <LeaseFields form={form} />
        <FileInput
          mt="md"
          label="Signed renewal"
          accept={FILE_ACCEPT}
          leftSection={<IconUpload size={16} />}
          clearable
          {...form.getInputProps('file')}
        />
        <ModalActions onClose={onClose} loading={save.isPending} label="Save renewal" />
      </form>
    </Modal>
  )
}

const PAYMENT_KINDS = [
  { value: 'rent', label: 'Rent' },
  { value: 'utility', label: 'Utility bill' },
  { value: 'other', label: 'Other' },
]

/** Add or edit a payment. `preset` pre-fills fields, e.g. { kind: 'utility', utility: '3' }. */
export function PaymentModal({ homeId, payment, preset, utilities = [], opened, onClose }) {
  const form = useForm({
    initialValues: {
      kind: payment?.kind ?? preset?.kind ?? 'other',
      utility: payment?.utility ? String(payment.utility) : (preset?.utility ?? null),
      title: payment?.title ?? '',
      amount: payment ? Number(payment.amount) : '',
      due_date: payment?.due_date ?? todayIso(),
      already_paid: Boolean(payment?.paid_on),
      paid_on: payment?.paid_on ?? todayIso(),
      note: payment?.note ?? '',
      receipt: null,
    },
    validate: {
      amount: (value) => (Number(value) > 0 ? null : 'Enter the amount'),
      due_date: (value) => (value ? null : 'Required'),
      utility: (value, values) => (values.kind === 'utility' && !value ? 'Choose the utility' : null),
    },
  })
  const save = useSave(
    async ({ receipt, already_paid, ...values }) => {
      const payload = {
        ...values,
        utility: values.kind === 'utility' ? Number(values.utility) : null,
        amount: toApiNumber(values.amount),
        paid_on: already_paid ? values.paid_on : null,
      }
      if (receipt) payload.receipt = (await uploadDocument({ property: homeId, kind: 'receipt', file: receipt })).id
      return payment
        ? api.patch(`/payments/${payment.id}/`, payload)
        : api.post('/payments/', { ...payload, property: homeId })
    },
    { success: 'Payment saved' },
  )
  return (
    <Modal opened={opened} onClose={onClose} title={payment ? 'Edit payment' : 'Add payment'}>
      <form onSubmit={submitWith(form, save, onClose)}>
        <Stack>
          <SegmentedControl data={PAYMENT_KINDS} {...form.getInputProps('kind')} />
          {form.values.kind === 'utility' && (
            <Select
              label="Utility"
              placeholder={utilities.length ? 'Choose' : 'Add a utility on the Utilities page first'}
              data={utilities.map((utility) => ({ value: String(utility.id), label: utility.name }))}
              {...form.getInputProps('utility')}
            />
          )}
          <TextInput label="Title" placeholder="Optional, e.g. Plumber" {...form.getInputProps('title')} />
          <SimpleGrid cols={2}>
            <NumberInput label="Amount, ₸" min={0} thousandSeparator=" " hideControls withAsterisk
              {...form.getInputProps('amount')} />
            <TextInput label="Due date" type="date" withAsterisk {...form.getInputProps('due_date')} />
          </SimpleGrid>
          <Checkbox label="Already paid" {...form.getInputProps('already_paid', { type: 'checkbox' })} />
          {form.values.already_paid && (
            <TextInput label="Paid on" type="date" {...form.getInputProps('paid_on')} />
          )}
          <FileInput label="Receipt" accept={FILE_ACCEPT} leftSection={<IconUpload size={16} />} clearable
            {...form.getInputProps('receipt')} />
          <Textarea label="Note" autosize minRows={1} {...form.getInputProps('note')} />
        </Stack>
        <ModalActions onClose={onClose} loading={save.isPending} />
      </form>
    </Modal>
  )
}

export function UtilityModal({ homeId, utility, opened, onClose }) {
  const form = useForm({
    initialValues: { name: utility?.name ?? '', unit: utility?.unit ?? '', has_meter: utility?.has_meter ?? true },
    validate: { name: (value) => (value.trim() ? null : 'Enter a name, e.g. Electricity') },
  })
  const save = useSave(
    (values) =>
      utility ? api.patch(`/utilities/${utility.id}/`, values) : api.post('/utilities/', { ...values, property: homeId }),
    { success: 'Utility saved' },
  )
  return (
    <Modal opened={opened} onClose={onClose} title={utility ? 'Edit utility' : 'Add utility'}>
      <form onSubmit={submitWith(form, save, onClose)}>
        <Stack>
          <TextInput label="Name" placeholder="Electricity, Cold water, Gas, Internet..." withAsterisk
            {...form.getInputProps('name')} />
          <TextInput label="Unit" placeholder="kWh, m³" {...form.getInputProps('unit')} />
          <Checkbox label="Has a meter I read every month" {...form.getInputProps('has_meter', { type: 'checkbox' })} />
        </Stack>
        <ModalActions onClose={onClose} loading={save.isPending} />
      </form>
    </Modal>
  )
}

export function ReadingModal({ homeId, utility, opened, onClose }) {
  const form = useForm({
    initialValues: { value: '', reading_date: todayIso(), note: '', photo: null },
    validate: {
      value: (value) => (value === '' ? 'Enter the number on the meter' : null),
      reading_date: (value) => (value ? null : 'Required'),
    },
  })
  const save = useSave(
    async ({ photo, ...values }) => {
      const payload = { ...values, utility: utility.id, value: toApiNumber(values.value) }
      if (photo) payload.photo = (await uploadDocument({ property: homeId, kind: 'meter', file: photo })).id
      return api.post('/meter-readings/', payload)
    },
    { success: 'Reading saved' },
  )
  const last = utility.last_reading
  return (
    <Modal opened={opened} onClose={onClose} title={`${utility.name} reading`}>
      <form onSubmit={submitWith(form, save, onClose)}>
        <Stack>
          {last && (
            <Text size="sm" c="dimmed">
              Last reading: {Number(last.value)} {utility.unit} on {formatDate(last.reading_date)}
            </Text>
          )}
          <SimpleGrid cols={2}>
            <NumberInput label={`Value${utility.unit ? `, ${utility.unit}` : ''}`} min={0} decimalScale={3}
              hideControls withAsterisk {...form.getInputProps('value')} />
            <TextInput label="Date" type="date" withAsterisk {...form.getInputProps('reading_date')} />
          </SimpleGrid>
          <FileInput label="Photo of the meter" accept={IMAGE_ACCEPT} leftSection={<IconUpload size={16} />}
            clearable {...form.getInputProps('photo')} />
          <Textarea label="Note" autosize minRows={1} {...form.getInputProps('note')} />
        </Stack>
        <ModalActions onClose={onClose} loading={save.isPending} />
      </form>
    </Modal>
  )
}

const ROOM_SUGGESTIONS = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Hallway', 'Balcony']

/** A Before (move-in) or After (move-out) photo of one thing in one room. */
export function ConditionPhotoModal({ homeId, stage = 'before', room = '', rooms = [], opened, onClose }) {
  const form = useForm({
    initialValues: { stage, file: null, room, item: '', description: '', taken_on: todayIso() },
    validate: {
      file: (value) => (value ? null : 'Choose a photo'),
      room: (value) => (value.trim() ? null : 'Which room is this?'),
    },
  })
  const save = useSave(
    (values) =>
      uploadDocument({
        property: homeId,
        kind: 'condition',
        file: values.file,
        room: values.room.trim(),
        item: values.item.trim(),
        stage: values.stage,
        description: values.description,
        takenOn: values.taken_on,
      }),
    { success: 'Photo added' },
  )
  const roomOptions = [...new Set([...rooms, ...ROOM_SUGGESTIONS])]
  return (
    <Modal opened={opened} onClose={onClose} title="Add new notice">
      <form onSubmit={submitWith(form, save, onClose)}>
        <Stack>
          <SegmentedControl
            data={[{ value: 'before', label: 'Before (move-in)' }, { value: 'after', label: 'After (move-out)' }]}
            {...form.getInputProps('stage')}
          />
          <FileInput label="Photo" description="JPG, PNG or WEBP up to 5 MB. Location data is removed."
            accept={IMAGE_ACCEPT} leftSection={<IconUpload size={16} />} withAsterisk clearable
            {...form.getInputProps('file')} />
          <SimpleGrid cols={2}>
            <Autocomplete label="Room" placeholder="Kitchen" data={roomOptions} withAsterisk
              {...form.getInputProps('room')} />
            <TextInput label="Item" placeholder="Sofa, table, cupboard..." {...form.getInputProps('item')} />
          </SimpleGrid>
          <Textarea label="What do you see?" placeholder="Stains, scratches, what is broken, what works"
            autosize minRows={2} {...form.getInputProps('description')} />
          <TextInput label="Photo taken on" type="date" {...form.getInputProps('taken_on')} />
        </Stack>
        <ModalActions onClose={onClose} loading={save.isPending} label="Add" />
      </form>
    </Modal>
  )
}

/** Upload (or replace) the signed lease file of the current contract. */
export function LeaseFileModal({ lease, opened, onClose }) {
  const form = useForm({
    initialValues: { file: null },
    validate: { file: (value) => (value ? null : 'Choose a file') },
  })
  const save = useSave(
    async ({ file }) => {
      const document = await uploadDocument({ property: lease.property, kind: 'lease', file })
      return api.patch(`/contracts/${lease.id}/`, { document: document.id })
    },
    { success: 'Lease file uploaded' },
  )
  return (
    <Modal opened={opened} onClose={onClose} title={lease.document_file ? 'Replace lease file' : 'Upload lease file'}>
      <form onSubmit={submitWith(form, save, onClose)}>
        <FileInput label="Signed lease" description="PDF up to 10 MB, or a photo up to 5 MB" accept={FILE_ACCEPT}
          leftSection={<IconUpload size={16} />} withAsterisk clearable {...form.getInputProps('file')} />
        <ModalActions onClose={onClose} loading={save.isPending} label="Upload" />
      </form>
    </Modal>
  )
}

/** "Make payment": record that a payment was made, with an optional receipt. No money is transferred. */
export function MarkPaidModal({ payment, opened, onClose }) {
  const form = useForm({ initialValues: { paid_on: todayIso(), receipt: null } })
  const save = useSave(
    async ({ paid_on, receipt }) => {
      const payload = { paid_on }
      if (receipt) payload.receipt = (await uploadDocument({ property: payment.property, kind: 'receipt', file: receipt })).id
      return api.post(`/payments/${payment.id}/mark-paid/`, payload)
    },
    { success: 'Payment recorded' },
  )
  return (
    <Modal opened={opened} onClose={onClose} title="Make payment">
      <form onSubmit={submitWith(form, save, onClose)}>
        <Stack>
          <Text size="sm">
            {payment.display_title} · {formatMoney(payment.amount)} · due {formatDate(payment.due_date)}
          </Text>
          <TextInput label="Paid on" type="date" {...form.getInputProps('paid_on')} />
          <FileInput label="Receipt or bank screenshot" description="Optional. PDF or photo." accept={FILE_ACCEPT}
            leftSection={<IconUpload size={16} />} clearable {...form.getInputProps('receipt')} />
          <Text size="xs" c="dimmed">MyRent only records the payment; it does not send money.</Text>
        </Stack>
        <ModalActions onClose={onClose} loading={save.isPending} label="Mark as paid" />
      </form>
    </Modal>
  )
}
