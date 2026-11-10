import { Accordion, Text } from '@mantine/core'

import { Panel, Tile } from '../components/ui'

const QUESTIONS = [
  ['How do I start?', 'Use "Add a rent" in the menu. Step 1 is the address and your landlord, step 2 the lease dates and rent, step 3 the signed contract. MyRent then creates one rent payment per month.'],
  ['How do reminders work?', 'MyRent looks at your payments every time you open it: anything overdue, due in the next 3 days, the meter-reading day, a lease that ends within 30 days and a repair that is not fixed after a week. They show on the bell, the dashboard and the calendar; click one to open the page where you can act on it.'],
  ['How do I record a payment?', 'Open Payments and press "Make payment" or "Pay" next to a payment. You can attach the receipt. MyRent only records the payment; it does not send money.'],
  ['How do I add utilities and meter readings?', 'Open Utilities and meters, add a category (electricity, water, gas...) and turn on "has a meter" for the ones you read. Then use "Reading" every month; MyRent shows how much you used.'],
  ['How much does this month cost me?', 'Open Payments: "Housing cost per month" adds up the rent and every bill due in that month, shows what is already paid and what is left. Use the arrows to look at other months.'],
  ['Something is broken. What do I do?', 'Tell your landlord first. Then open Repair requests, add what is broken, the date you told the landlord and a photo. MyRent counts the days until it is fixed and reminds you if it is still open after a week.'],
  ['What are Before and After photos?', 'Before: photos of every room and every scratch on the day you move in. After: the same photos when you move out. Dated photos protect your deposit.'],
  ['My lease was extended. What do I do?', 'Open Contract and press "Renew". The old lease and its paid history stay; new rent payments follow the new terms.'],
  ['Are my files private?', 'Yes. Only you can see your data. Files are never public: they open through links that expire after 10 minutes, and photos are saved without location data.'],
  ['How do I delete my data?', 'Account → Delete my account removes your account, every home, payment and file.'],
]

export default function HelpPage() {
  return (
    <div className="mr-split">
      <Panel title="We are always ready to help you!">
        <Accordion variant="separated" radius="lg"
          styles={{ item: { backgroundColor: 'var(--mr-bg)', border: 'none' }, label: { fontWeight: 600 } }}>
          {QUESTIONS.map(([question, answer]) => (
            <Accordion.Item key={question} value={question}>
              <Accordion.Control>{question}</Accordion.Control>
              <Accordion.Panel><Text size="sm">{answer}</Text></Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Panel>
      <div className="mr-side">
        <Tile tone="dark" label="MyRent" value="super app for rental">
          <Text size="sm" mt={6} c="#eadfdc">A student project of Group 12, IT Project Management (PjM 101), KBTU.</Text>
        </Tile>
        <Tile label="Your data" value="Private by default" sub="Only you can see your homes, payments and files." />
      </div>
    </div>
  )
}
