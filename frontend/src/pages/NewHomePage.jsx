import { Button, FileInput, Group, Paper, Stack, Stepper, Text } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconUpload } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, fieldErrors } from '../api/client'
import { uploadDocument, useSave } from '../api/queries'
import { PageHeader } from '../components/common'
import { HomeFields, LeaseFields } from '../components/forms'
import { FILE_ACCEPT } from '../components/modals'
import { emptyHome, emptyLease, homeToApi, homeValidation, leaseToApi, leaseValidation } from '../lib/formValues'

/** Three steps, each saved as soon as it is done: home -> lease -> lease file. */
export default function NewHomePage() {
  const navigate = useNavigate()
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

  return (
    <>
      <PageHeader title="Add a home" subtitle="Three short steps. You can change everything later." />
      <Paper withBorder p={{ base: 'md', sm: 'xl' }} radius="lg" maw={860}>
        <Stepper active={step} size="sm" allowNextStepsSelect={false}>
          <Stepper.Step label="Home" description="Address and landlord">
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
              <HomeFields form={homeForm} />
              <Group justify="flex-end" mt="xl">
                <Button type="submit" loading={saveHome.isPending}>
                  Next
                </Button>
              </Group>
            </form>
          </Stepper.Step>

          <Stepper.Step label="Lease" description="Dates and rent">
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
              <Stack>
                <Text size="sm" c="dimmed">
                  MyRent creates one rent payment per month from these dates, so the calendar and reminders work
                  straight away.
                </Text>
                <LeaseFields form={leaseForm} />
              </Stack>
              <Group justify="space-between" mt="xl">
                <Button variant="subtle" color="gray" onClick={finish}>
                  Skip, add the lease later
                </Button>
                <Button type="submit" loading={saveLease.isPending}>
                  Save lease
                </Button>
              </Group>
            </form>
          </Stepper.Step>

          <Stepper.Step label="Lease file" description="PDF or photo">
            <form onSubmit={fileForm.onSubmit((values) => saveFile.mutate(values, { onSuccess: finish }))}>
              <Stack>
                <Text size="sm" c="dimmed">
                  Keep the signed lease here so you never have to search for it in chats again. It is stored
                  privately and only opens through short-lived links.
                </Text>
                <FileInput
                  label="Signed lease"
                  description="PDF up to 10 MB, or a photo up to 5 MB"
                  accept={FILE_ACCEPT}
                  leftSection={<IconUpload size={16} />}
                  clearable
                  {...fileForm.getInputProps('file')}
                />
              </Stack>
              <Group justify="space-between" mt="xl">
                <Button variant="subtle" color="gray" onClick={finish}>
                  Skip
                </Button>
                <Button type="submit" loading={saveFile.isPending} disabled={!fileForm.values.file}>
                  Upload and finish
                </Button>
              </Group>
            </form>
          </Stepper.Step>
        </Stepper>
      </Paper>
    </>
  )
}
