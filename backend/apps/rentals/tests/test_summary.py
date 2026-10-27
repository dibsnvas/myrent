from datetime import date
from unittest import mock

from rest_framework import status

from django.urls import reverse

from apps.rentals.models import Payment, Utility
from apps.rentals.tests.base import RentalsTestCase

TODAY = date(2026, 10, 27)


@mock.patch('django.utils.timezone.localdate', return_value=TODAY)
class MonthSummaryTests(RentalsTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.make_contract(self.home, date(2026, 10, 1), date(2027, 9, 30), rent='250000', due_day=5)
        power = Utility.objects.create(property=self.home, name='Electricity', unit='kWh', has_meter=True)
        water = Utility.objects.create(property=self.home, name='Water', unit='m³', has_meter=True)
        for utility, amount in ((power, '7550'), (water, '4890'), (power, '6000')):
            Payment.objects.create(
                property=self.home, kind='utility', utility=utility, amount=amount, due_date=date(2026, 10, 20)
            )
        self.url = reverse('property-month-summary', args=[self.home.id])

    def test_october_rent_and_bills(self, _today) -> None:
        """US-11: October has rent 250 000 and bills of 18 440, so the month costs 268 440."""
        Payment.objects.filter(kind='rent', due_date=date(2026, 10, 5)).update(paid_on=date(2026, 10, 4))
        data = self.client.get(self.url).data
        self.assertEqual(data['month'], '2026-10')
        self.assertEqual(data['rent'], '250000.00')
        self.assertEqual(data['utilities'], '18440.00')
        self.assertEqual(data['total'], '268440.00')
        self.assertEqual(data['paid'], '250000.00')
        self.assertEqual(data['left'], '18440.00')
        self.assertEqual(
            data['utilities_by_name'],
            [{'name': 'Electricity', 'amount': '13550.00'}, {'name': 'Water', 'amount': '4890.00'}],
        )

    def test_other_month_and_bad_month(self, _today) -> None:
        november = self.client.get(self.url, {'month': '2026-11'}).data
        self.assertEqual(
            (november['rent'], november['utilities'], november['total']), ('250000.00', '0.00', '250000.00')
        )
        self.assertEqual(self.client.get(self.url, {'month': 'october'}).status_code, status.HTTP_400_BAD_REQUEST)

    def test_other_tenant_gets_404(self, _today) -> None:
        self.as_other()
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_404_NOT_FOUND)
