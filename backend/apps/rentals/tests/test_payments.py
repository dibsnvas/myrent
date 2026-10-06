from datetime import date
from unittest import mock

from rest_framework import status

from django.urls import reverse

from apps.rentals.models import MeterReading, Payment, Utility
from apps.rentals.tests.base import RentalsTestCase

TODAY = date(2026, 10, 1)


@mock.patch('django.utils.timezone.localdate', return_value=TODAY)
class PaymentTests(RentalsTestCase):
    def test_status_and_mark_paid(self, _today) -> None:
        payment = Payment.objects.create(property=self.home, kind='other', amount=500, due_date=date(2026, 9, 20))
        url = reverse('payment-detail', args=[payment.id])
        self.assertEqual(self.client.get(url).data['status'], 'overdue')

        paid = self.client.post(reverse('payment-mark-paid', args=[payment.id]), {}, format='json')
        self.assertEqual(paid.data['status'], 'paid')
        self.assertEqual(paid.data['paid_on'], '2026-10-01')

        unpaid = self.client.post(reverse('payment-mark-unpaid', args=[payment.id]))
        self.assertEqual(unpaid.data['status'], 'overdue')

    def test_utility_bill_needs_a_utility(self, _today) -> None:
        response = self.client.post(reverse('payment-list'), {
            'property': self.home.id, 'kind': 'utility', 'amount': '100', 'due_date': '2026-10-20',
        }, format='json')
        self.assertIn('utility', response.data)

    def test_filters_by_month_and_status(self, _today) -> None:
        self.make_contract(self.home, date(2026, 1, 1), date(2026, 12, 31), due_day=1)
        october = self.client.get(reverse('payment-list'), {'month': '2026-10'}).data
        self.assertEqual([p['due_date'] for p in october], ['2026-10-01'])
        overdue = self.client.get(reverse('payment-list'), {'status': 'overdue'}).data
        self.assertEqual(len(overdue), 9)  # Jan..Sep, nothing paid


@mock.patch('django.utils.timezone.localdate', return_value=TODAY)
class UtilityAndMeterTests(RentalsTestCase):
    def test_meter_reading_consumption_and_meterless_utility(self, _today) -> None:
        power = Utility.objects.create(property=self.home, name='Electricity', unit='kWh', has_meter=True)
        for day, value in ((date(2026, 8, 25), '100.5'), (date(2026, 9, 25), '160')):
            response = self.client.post(reverse('meter-reading-list'), {
                'utility': power.id, 'value': value, 'reading_date': day.isoformat(),
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(MeterReading.objects.first().property, self.home)
        latest = self.client.get(reverse('meter-reading-list'), {'utility': power.id}).data[0]
        self.assertEqual(latest['consumption'], '59.500')

        internet = Utility.objects.create(property=self.home, name='Internet', has_meter=False)
        response = self.client.post(reverse('meter-reading-list'), {
            'utility': internet.id, 'value': '1', 'reading_date': '2026-09-25',
        }, format='json')
        self.assertIn('utility', response.data)

    def test_utility_names_are_unique_per_home(self, _today) -> None:
        Utility.objects.create(property=self.home, name='Water')
        response = self.client.post(reverse('utility-list'), {'property': self.home.id, 'name': 'water'},
                                    format='json')
        self.assertIn('name', response.data)


@mock.patch('django.utils.timezone.localdate', return_value=TODAY)
class DashboardTests(RentalsTestCase):
    def test_dashboard_numbers(self, _today) -> None:
        self.make_contract(self.home, date(2026, 9, 1), date(2027, 8, 31), rent='200000', due_day=1)
        response = self.client.get(reverse('property-dashboard', args=[self.home.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['overdue'], {'count': 1, 'total': '200000.00'})  # September
        self.assertEqual(data['next_rent']['due_date'], '2026-10-01')
        self.assertEqual(data['this_month']['unpaid'], '200000.00')
        self.assertIsNotNone(data['property']['active_contract'])
        self.assertEqual([p['due_date'] for p in data['upcoming']][:2], ['2026-09-01', '2026-10-01'])
        self.assertIsNone(data['average_utility_bill'])
        self.assertIsNone(data['next_utility_bill'])

    def test_dashboard_utility_figures(self, _today) -> None:
        power = Utility.objects.create(property=self.home, name='Electricity', has_meter=True)
        for due, amount in ((date(2026, 7, 20), 6000), (date(2026, 8, 20), 8000), (date(2026, 9, 20), 7000),
                            (date(2026, 9, 25), 3000), (date(2026, 10, 20), 9000)):
            Payment.objects.create(property=self.home, kind='utility', utility=power, amount=amount, due_date=due)
        data = self.client.get(reverse('property-dashboard', args=[self.home.id])).data
        # last three months with bills up to today: Jul 6000, Aug 8000, Sep 7000 + 3000
        self.assertEqual(data['average_utility_bill'], '8000.00')
        self.assertEqual(data['next_utility_bill']['due_date'], '2026-10-20')
