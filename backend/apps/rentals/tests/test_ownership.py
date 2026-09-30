from datetime import date

from rest_framework import status

from django.urls import reverse

from apps.rentals.models import Payment, Utility
from apps.rentals.tests.base import RentalsTestCase


class OwnershipTests(RentalsTestCase):
    """Test case for Amina: tenant B must not read or touch anything of tenant A."""

    def test_other_tenant_gets_404_for_my_home(self) -> None:
        self.as_other()
        response = self.client.get(reverse('property-detail', args=[self.home.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get(reverse('property-list')).data, [])

    def test_other_tenant_cannot_add_payment_to_my_home(self) -> None:
        self.as_other()
        response = self.client.post(reverse('payment-list'), {
            'property': self.home.id, 'kind': 'other', 'amount': '100', 'due_date': '2026-10-10',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('property', response.data)
        self.assertFalse(Payment.objects.exists())

    def test_cannot_link_utility_from_another_home(self) -> None:
        my_second_home = self.make_property(self.user, title='Second')
        utility = Utility.objects.create(property=my_second_home, name='Gas', has_meter=True)
        response = self.client.post(reverse('payment-list'), {
            'property': self.home.id, 'kind': 'utility', 'utility': utility.id, 'amount': '100',
            'due_date': '2026-10-10',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('utility', response.data)

    def test_lists_are_limited_to_my_rows(self) -> None:
        self.make_contract(self.home, date(2026, 1, 1), date(2026, 12, 31))
        their_home = self.make_property(self.other)
        self.make_contract(their_home, date(2026, 1, 1), date(2026, 12, 31))
        payments = self.client.get(reverse('payment-list')).data
        self.assertEqual({p['property'] for p in payments}, {self.home.id})
        calendar = self.client.get(reverse('calendar'), {'month': '2026-03'}).data
        self.assertEqual({e['property_id'] for e in calendar}, {self.home.id})

    def test_api_requires_login(self) -> None:
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse('property-list')).status_code, status.HTTP_401_UNAUTHORIZED)
