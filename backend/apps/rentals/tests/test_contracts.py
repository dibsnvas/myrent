from datetime import date

from rest_framework import status

from django.urls import reverse

from apps.rentals.models import Contract, Payment
from apps.rentals.services.schedule import rent_due_dates
from apps.rentals.tests.base import RentalsTestCase


class RentScheduleTests(RentalsTestCase):
    def test_rent_due_dates_one_per_month(self) -> None:
        dates = rent_due_dates(date(2026, 10, 15), date(2027, 10, 14), 15)
        self.assertEqual(len(dates), 12)
        self.assertEqual(dates[0], date(2026, 10, 15))
        self.assertEqual(dates[-1], date(2027, 9, 15))
        # Due day before the start day: first rent is next month.
        self.assertEqual(rent_due_dates(date(2026, 10, 15), date(2027, 10, 14), 1)[0], date(2026, 11, 1))

    def test_creating_a_contract_generates_rent_rows(self) -> None:
        response = self.client.post(reverse('contract-list'), {
            'property': self.home.id, 'start_date': '2026-10-01', 'end_date': '2027-09-30',
            'monthly_rent': '250000', 'rent_due_day': 1,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        rent = Payment.objects.filter(kind=Payment.Kind.RENT)
        self.assertEqual(rent.count(), 12)
        self.assertEqual(rent.first().period, date(2026, 10, 1))

    def test_editing_rent_keeps_paid_rows(self) -> None:
        contract = self.make_contract(self.home, date(2026, 1, 1), date(2026, 12, 31), rent='100000', due_day=1)
        january = contract.payments.get(due_date=date(2026, 1, 1))
        january.paid_on = date(2026, 1, 1)
        january.save()
        response = self.client.patch(reverse('contract-detail', args=[contract.id]), {'monthly_rent': '120000'},
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        january.refresh_from_db()
        self.assertEqual(january.amount, 100000)
        self.assertEqual(contract.payments.count(), 12)
        self.assertEqual(contract.payments.get(due_date=date(2026, 2, 1)).amount, 120000)

    def test_second_overlapping_active_lease_is_rejected(self) -> None:
        self.make_contract(self.home, date(2026, 1, 1), date(2026, 12, 31))
        response = self.client.post(reverse('contract-list'), {
            'property': self.home.id, 'start_date': '2026-06-01', 'end_date': '2027-05-31',
            'monthly_rent': '1', 'rent_due_day': 1,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_end_must_be_after_start(self) -> None:
        response = self.client.post(reverse('contract-list'), {
            'property': self.home.id, 'start_date': '2026-06-01', 'end_date': '2026-05-01',
            'monthly_rent': '1', 'rent_due_day': 1,
        }, format='json')
        self.assertIn('end_date', response.data)


class RenewalTests(RentalsTestCase):
    def test_renewal_keeps_original_and_replaces_future_unpaid_rent(self) -> None:
        old = self.make_contract(self.home, date(2026, 1, 1), date(2026, 12, 31), rent='100000', due_day=1)
        response = self.client.post(reverse('contract-renew', args=[old.id]), {
            'start_date': '2026-10-01', 'end_date': '2027-09-30', 'monthly_rent': '110000',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        old.refresh_from_db()
        new = Contract.objects.get(pk=response.data['id'])
        self.assertEqual(old.status, Contract.Status.SUPERSEDED)
        self.assertEqual(new.previous, old)
        self.assertEqual(new.rent_due_day, 1)  # copied from the old lease
        rent = Payment.objects.filter(kind=Payment.Kind.RENT)
        # Jan..Sep from the old lease, Oct 2026..Sep 2027 from the renewal: no month charged twice.
        self.assertEqual(rent.filter(contract=old).count(), 9)
        self.assertEqual(rent.filter(contract=new).count(), 12)
        self.assertEqual(rent.filter(due_date=date(2026, 10, 1)).get().amount, 110000)

    def test_cannot_renew_twice_and_deleting_renewal_restores_old(self) -> None:
        old = self.make_contract(self.home, date(2026, 1, 1), date(2026, 12, 31), due_day=1)
        new_id = self.client.post(reverse('contract-renew', args=[old.id]), {'end_date': '2027-12-31'},
                                  format='json').data['id']
        again = self.client.post(reverse('contract-renew', args=[old.id]), {'end_date': '2028-12-31'}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.delete(reverse('contract-detail', args=[new_id]))
        old.refresh_from_db()
        self.assertEqual(old.status, Contract.Status.ACTIVE)
        self.assertEqual(old.payments.count(), 12)
