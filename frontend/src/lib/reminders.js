// Reminder keys start with what they are about ('payment:12:...', 'meter:3:...', 'contract-end:5:...', 'repair:7:...').
const SECTION_BY_KIND = { payment: 'payments', meter: 'utilities', 'contract-end': 'contract', repair: 'repairs' }

/** Where the tenant acts on a reminder: rent and bills on Payments, meter days on Utilities, lease ends on Contract. */
export function reminderPath(reminder) {
  const section = SECTION_BY_KIND[reminder.key.split(':')[0]]
  return section ? `/homes/${reminder.property_id}/${section}` : `/homes/${reminder.property_id}`
}
