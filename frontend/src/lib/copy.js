/**
 * Wording that depends on the role chosen at onboarding. Screens and data are the same;
 * a landlord sees "tenant" where a tenant sees "landlord", "received" where a tenant sees "paid".
 */
export const COPY = {
  tenant: {
    home: 'home',
    addHome: 'Add a home',
    editHome: 'Edit home',
    choosePlaceholder: 'Choose a home',
    namePlaceholder: 'Flat on Abay',
    contactTitle: 'Landlord',
    contactName: 'Landlord name',
    contactPhone: 'Landlord phone',
    contactEmail: 'Landlord email',
    contactStep: 'Address and landlord',
    noContact: 'No landlord contacts saved.',
    leaseIntro:
      'MyRent creates one rent payment per month from these dates, so the calendar and reminders work straight away.',
    nextRent: 'Next rent',
    noUpcomingRent: 'No upcoming rent',
    overdueNone: 'All paid on time',
    overdueSome: (count) => `${count} unpaid ${count === 1 ? 'payment' : 'payments'}`,
    monthPaid: 'paid',
    monthLeft: 'left',
    markPaid: 'Paid',
    markUnpaid: 'Mark as unpaid',
    paymentsSubtitle: 'Rent is created from your lease. Add utility bills and anything else you pay for the home.',
    statusLabels: { paid: 'Paid', due: 'Due', overdue: 'Overdue' },
    emptyTitle: 'Add the home you rent',
    emptyText:
      'Start with the address and your lease. MyRent then builds your rent calendar and reminds you before every payment.',
    conditionHint:
      'On move-in, photograph every room and every existing scratch, stain or broken thing. Dated photos protect your deposit when you move out.',
  },
  landlord: {
    home: 'property',
    addHome: 'Add a property',
    editHome: 'Edit property',
    choosePlaceholder: 'Choose a property',
    namePlaceholder: 'Studio on Tole bi',
    contactTitle: 'Tenant',
    contactName: 'Tenant name',
    contactPhone: 'Tenant phone',
    contactEmail: 'Tenant email',
    contactStep: 'Address and tenant',
    noContact: 'No tenant contacts saved.',
    leaseIntro:
      'MyRent creates one rent payment per month from these dates, so you see at a glance whether the tenant has paid.',
    nextRent: 'Next rent to receive',
    noUpcomingRent: 'Nothing to receive soon',
    overdueNone: 'Tenant pays on time',
    overdueSome: (count) => `${count} late ${count === 1 ? 'payment' : 'payments'}`,
    monthPaid: 'received',
    monthLeft: 'still to come',
    markPaid: 'Received',
    markUnpaid: 'Mark as not received',
    paymentsSubtitle:
      'Rent is created from the lease. Mark it as received when the tenant pays, and add repairs or other costs too.',
    statusLabels: { paid: 'Received', due: 'Due', overdue: 'Late' },
    emptyTitle: 'Add the property you rent out',
    emptyText:
      'Add the address, the tenant and the lease. MyRent then tracks every month’s rent and shows you who is late.',
    conditionHint:
      'At move-in, photograph every room and anything already worn or broken. Dated photos settle deposit questions when the tenant moves out.',
  },
}
