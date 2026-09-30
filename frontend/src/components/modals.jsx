import {
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
import { formatDate, isoDate, parseIso, todayIso, toApiNumber } from '../lib/format'
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

const DOCUMENT_KINDS = [
  { value: 'condition', label: 'Condition photo' },
  { value: 'lease', label: 'Lease' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'other', label: 'Other' },
]

export function UploadModal({ homeId, defaultKind = 'condition', opened, onClose }) {
  const form = useForm({
    initialValues: { kind: defaultKind, file: null, room: '', description: '', taken_on: todayIso() },
    validate: {
      file: (value) => (value ? null : 'Choose a file'),
      room: (value, values) => (values.kind === 'condition' && !value.trim() ? 'Which room is this?' : null),
    },
  })
  const isPhoto = form.values.kind === 'condition'
  const save = useSave(
    (values) =>
      uploadDocument({
        property: homeId,
        kind: values.kind,
        file: values.file,
        room: isPhoto ? values.room : '',
        description: values.description,
        takenOn: isPhoto ? values.taken_on : '',
      }),
    { success: 'Uploaded' },
  )
  return (
    <Modal opened={opened} onClose={onClose} title="Upload">
      <form onSubmit={submitWith(form, save, onClose)}>
        <Stack>
          <Select label="Type" data={DOCUMENT_KINDS} allowDeselect={false} {...form.getInputProps('kind')} />
          <FileInput
            label="File"
            description={isPhoto ? 'JPG, PNG or WEBP up to 5 MB. Location data is removed.' : 'PDF up to 10 MB or image up to 5 MB'}
            accept={isPhoto ? IMAGE_ACCEPT : FILE_ACCEPT}
            leftSection={<IconUpload size={16} />}
            withAsterisk
            clearable
            {...form.getInputProps('file')}
          />
          {isPhoto && (
            <SimpleGrid cols={2}>
              <TextInput label="Room" placeholder="Kitchen" withAsterisk {...form.getInputProps('room')} />
              <TextInput label="Photo taken on" type="date" {...form.getInputProps('taken_on')} />
            </SimpleGrid>
          )}
          <Textarea
            label="Description"
            placeholder={isPhoto ? 'Scratches, stains, what is broken, what works' : 'Optional'}
            autosize
            minRows={2}
            {...form.getInputProps('description')}
          />
        </Stack>
        <ModalActions onClose={onClose} loading={save.isPending} label="Upload" />
      </form>
    </Modal>
  )
}
