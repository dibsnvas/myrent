from datetime import date
from unittest import mock

from rest_framework import status

from django.core import mail
from django.test import override_settings
from django.urls import reverse

from apps.rentals.models import MeterReading, Payment, ReminderLog, Utility
from apps.rentals.services.events import reminders_for
from apps.rentals.tests.base import RentalsTestCase

TODAY = date(2026, 10, 1)


class ReminderTests(RentalsTestCase):
    def test_overdue_and_due_soon_payments(self) -> None:
        Payment.objects.create(property=self.home, kind='rent', amount=1, due_date=date(2026, 9, 5))
        Payment.objects.create(property=self.home, kind='rent', amount=1, due_date=date(2026, 10, 3))
        Payment.objects.create(property=self.home, kind='rent', amount=1, due_date=date(2026, 10, 20))
        reminders = reminders_for(self.user, TODAY)
        self.assertEqual([(r.level, r.date) for r in reminders], [
            ('overdue', date(2026, 9, 5)),
            ('soon', date(2026, 10, 3)),
        ])

    def test_meter_reminder_until_reading_recorded(self) -> None:
        self.home.meter_reading_day = 3
        self.home.save()
        power = Utility.objects.create(property=self.home, name='Electricity', has_meter=True)
        self.assertEqual([r.title for r in reminders_for(self.user, TODAY)], ['Meter readings are due'])
        MeterReading.objects.create(property=self.home, utility=power, value=1, reading_date=TODAY)
        self.assertEqual(reminders_for(self.user, TODAY), [])

    def test_missed_meter_day_is_overdue(self) -> None:
        self.home.meter_reading_day = 25
        self.home.save()
        Utility.objects.create(property=self.home, name='Water', has_meter=True)
        reminders = reminders_for(self.user, date(2026, 10, 27))
        self.assertEqual([(r.level, r.date) for r in reminders], [('overdue', date(2026, 10, 25))])

    def test_lease_ending_soon(self) -> None:
        self.make_contract(self.home, date(2025, 10, 20), date(2026, 10, 19), due_day=20)
        titles = [r.title for r in reminders_for(self.user, TODAY)]
        self.assertIn('Lease ends soon', titles)

    @mock.patch('django.utils.timezone.localdate', return_value=TODAY)
    def test_reminders_endpoint(self, _today) -> None:
        Payment.objects.create(property=self.home, kind='rent', amount=1, due_date=date(2026, 9, 5))
        response = self.client.get(reverse('reminders'))
        self.assertEqual(response.data[0]['level'], 'overdue')


@override_settings(CRON_SECRET='test-secret')
@mock.patch('django.utils.timezone.localdate', return_value=TODAY)
class SendRemindersTests(RentalsTestCase):
    def test_wrong_secret_is_rejected(self, _today) -> None:
        self.client.force_authenticate(None)
        response = self.client.post(reverse('send-reminders'), HTTP_X_CRON_SECRET='nope')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sends_once_per_reminder(self, _today) -> None:
        Payment.objects.create(property=self.home, kind='rent', amount=1, due_date=date(2026, 9, 5))
        self.client.force_authenticate(None)
        first = self.client.post(reverse('send-reminders'), HTTP_X_CRON_SECRET='test-secret')
        self.assertEqual(first.data, {'emails_sent': 1})
        self.assertEqual(mail.outbox[0].to, ['a@example.com'])
        self.assertIn('Rent is overdue', mail.outbox[0].body)

        second = self.client.post(reverse('send-reminders'), HTTP_X_CRON_SECRET='test-secret')
        self.assertEqual(second.data, {'emails_sent': 0})
        self.assertEqual(ReminderLog.objects.count(), 1)
