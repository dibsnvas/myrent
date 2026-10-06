import { Button, FileInput, Group, Stack, Text, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconArrowRight, IconUpload } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, fieldErrors } from '../api/client'
import { uploadDocument, useProperties, useSave } from '../api/queries'
import { HomeFields, LeaseFields } from '../components/forms'
import { FILE_ACCEPT } from '../components/modals'
import { Panel, Steps } from '../components/ui'
import { emptyHome, emptyLease, homeToApi, homeValidation, leaseToApi, leaseValidation } from '../lib/formValues'

const STEPS = ['Address and landlord', 'Dates and rent', 'PDF or photo']

/** "Add your first rent right now!": three steps, each saved as soon as it is done. */
export default function NewHomePage() {
  const navigate = useNavigate()
  const { data: homes = [] } = useProperties()
  const [step, setStep] = useState(0)
  const [home, setHome] = useState(null)
  const [lease, setLease] = useState(null)

  const homeForm = useForm({ initialValues: emptyHome, validate: homeValidation })
  const leaseForm = useForm({ initialValues: emptyLease, validate: leaseValidation })
  const fileForm = useForm({ initialValues: { file: null } })

  const saveHome = useSave((values) =>
    home ? api.patch(`/properties/${home.id}/`, homeToApi(values)) : api.post('/properties/', homeToApi(values)),
  )
  const saveLease = useSave(
    (values) =>
      lease
        ? api.patch(`/contracts/${lease.id}/`, leaseToApi(values))
        : api.post('/contracts/', { ...leaseToApi(values), property: home.id }),
    { success: 'Lease saved, rent schedule created' },
  )
  const saveFile = useSave(
    async ({ file }) => {
      const document = await uploadDocument({ property: home.id, kind: 'lease', file })
      return api.patch(`/contracts/${lease.id}/`, { document: document.id })
    },
    { success: 'Lease file uploaded' },
  )

  const finish = () => navigate(`/homes/${home.id}`, { replace: true })
  const isFirst = !home && homes.length === 0

  const footer = (submitLabel, loading, { skip, disabled } = {}) => (
    <Group justify="flex-end" mt="xl" gap="sm">
      {skip && (
        <Button color="rose.4" onClick={skip}>
          Skip
        </Button>
      )}
      <Button type="submit" loading={loading} disabled={disabled} rightSection={<IconArrowRight size={16} />}>
        {submitLabel}
      </Button>
    </Group>
  )

  return (
    <Panel>
      <Stack gap={2} align="center" mb="md">
        <Title order={2} fz={26} fw={800} ta="center">
          {isFirst ? 'Add your first rent right now!' : 'Add a rent'}
        </Title>
        <Text size="sm" c="dimmed">Fill the form. You can change everything later.</Text>
      </Stack>
      <Steps steps={STEPS} active={step} />

      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {step === 0 && (
          <form
            onSubmit={homeForm.onSubmit((values) =>
              saveHome.mutate(values, {
                onSuccess: ({ data }) => {
                  setHome(data)
                  setStep(1)
                },
                onError: (error) => homeForm.setErrors(fieldErrors(error)),
              }),
            )}
          >
            <HomeFields form={homeForm} showMeterDay={false} />
            {footer('Next', saveHome.isPending)}
          </form>
        )}

        {step === 1 && (
          <form
            onSubmit={leaseForm.onSubmit((values) =>
              saveLease.mutate(values, {
                onSuccess: ({ data }) => {
                  setLease(data)
                  setStep(2)
                },
                onError: (error) => leaseForm.setErrors(fieldErrors(error)),
              }),
            )}
          >
            <LeaseFields form={leaseForm} />
            <Text size="xs" c="dimmed" mt="sm">
              MyRent creates one rent payment per month from these dates, so the calendar and reminders work straight away.
            </Text>
            {footer('Next', saveLease.isPending, { skip: finish })}
          </form>
        )}

        {step === 2 && (
          <form onSubmit={fileForm.onSubmit((values) => saveFile.mutate(values, { onSuccess: finish }))}>
            <FileInput
              label="Upload contract file"
              description="PDF up to 10 MB, or a photo up to 5 MB. Stored privately."
              accept={FILE_ACCEPT}
              rightSection={<IconUpload size={16} />}
              clearable
              {...fileForm.getInputProps('file')}
            />
            {footer('Finish', saveFile.isPending, { skip: finish, disabled: !fileForm.values.file })}
          </form>
        )}
      </div>
    </Panel>
  )
}
