from datetime import date
from unittest import mock

from rest_framework import status

from django.urls import reverse

from apps.auths.models import User
from apps.rentals.services.events import reminders_for
from apps.rentals.tests.base import RentalsTestCase

TODAY = date(2026, 10, 1)


class LandlordTests(RentalsTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user.role = User.Role.LANDLORD
        self.user.save()
        self.home.contact_name = 'Aru S.'
        self.home.save()

    def test_rent_reminders_name_the_tenant(self) -> None:
        contract = self.make_contract(self.home, date(2026, 8, 1), date(2027, 7, 31), due_day=1)
        contract.payments.filter(due_date=date(2026, 8, 1)).update(paid_on=date(2026, 8, 1))
        titles = [r.title for r in reminders_for(self.user, TODAY)]
        self.assertEqual(titles, ['Rent from Aru S. is overdue', 'Rent from Aru S. is due today'])

    def test_tenant_wording_is_unchanged(self) -> None:
        self.user.role = User.Role.TENANT
        self.user.save()
        self.make_contract(self.home, date(2026, 9, 1), date(2027, 8, 31), due_day=1)
        self.assertEqual(reminders_for(self.user, TODAY)[0].title, 'Rent is overdue')

    @mock.patch('django.utils.timezone.localdate', return_value=TODAY)
    def test_overview_totals_and_statuses(self, _today) -> None:
        late = self.make_property(self.user, title='A flat', contact_name='Timur B.')
        self.make_contract(late, date(2026, 9, 10), date(2027, 9, 9), rent='300000', due_day=10)
        paid = self.make_property(self.user, title='B room')
        contract = self.make_contract(paid, date(2026, 10, 1), date(2027, 9, 30), rent='100000', due_day=1)
        contract.payments.filter(due_date=TODAY).update(paid_on=TODAY)
        ending = self.make_contract(self.home, date(2025, 10, 20), date(2026, 10, 19), rent='50000', due_day=20)
        ending.payments.filter(due_date__lt=TODAY).update(paid_on=date(2026, 1, 1))

        data = self.client.get(reverse('property-overview')).data
        self.assertEqual(data['totals'], {
            'properties': 3, 'leased': 3, 'month_expected': '400000.00', 'month_received': '100000.00',
            'overdue_total': '300000.00', 'overdue_count': 1,
        })
        rows = {row['title']: row for row in data['properties']}
        self.assertEqual(rows['A flat']['month_status'], 'due')  # October not yet due; September late
        self.assertEqual(rows['A flat']['overdue_count'], 1)
        self.assertEqual(rows['B room']['month_status'], 'paid')
        self.assertTrue(rows['Home']['lease_ends_soon'])
        self.assertEqual(rows['Home']['month_status'], 'none')  # lease ends 19 Oct, before its rent day

    def test_overview_only_shows_my_properties(self) -> None:
        self.make_property(self.other, title='Not mine')
        response = self.client.get(reverse('property-overview'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row['title'] for row in response.data['properties']], ['Home'])
