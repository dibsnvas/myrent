from datetime import date
from unittest import mock

from rest_framework import status

from django.urls import reverse

from apps.rentals.models import RepairRequest
from apps.rentals.tests.base import RentalsTestCase, image_upload

TODAY = date(2026, 11, 3)


@mock.patch('django.utils.timezone.localdate', return_value=TODAY)
class RepairRequestTests(RentalsTestCase):
    def create(self, **fields):
        body = {'property': self.home.id, 'title': 'Leaking tap', 'reported_on': '2026-10-03'} | fields
        return self.client.post(reverse('repair-list'), body, format='json')

    def test_open_request_counts_days_since_report(self, _today) -> None:
        """US-12: the tap has leaked since 03.10.2026, so on 03.11.2026 the request is open for 31 days."""
        photo = self.client.post(reverse('document-list'), {
            'property': self.home.id, 'kind': 'repair', 'file': image_upload('tap.jpg'),
        }, format='multipart')
        self.assertEqual(photo.status_code, status.HTTP_201_CREATED, photo.data)

        response = self.create(photo=photo.data['id'], description='Drips all night')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], 'open')
        self.assertEqual(response.data['days_open'], 31)
        self.assertIsNone(response.data['resolved_on'])
        self.assertTrue(response.data['photo_file']['is_image'])

    def test_resolve_stops_the_count_and_reopen_restarts_it(self, _today) -> None:
        repair_id = self.create().data['id']
        url = reverse('repair-detail', args=[repair_id])

        resolved = self.client.patch(url, {'status': 'resolved', 'resolved_on': '2026-10-10'}, format='json')
        self.assertEqual(resolved.status_code, status.HTTP_200_OK, resolved.data)
        self.assertEqual((resolved.data['resolved_on'], resolved.data['days_open']), ('2026-10-10', 7))

        reopened = self.client.patch(url, {'status': 'open'}, format='json')
        self.assertEqual((reopened.data['resolved_on'], reopened.data['days_open']), (None, 31))

        today = self.client.patch(url, {'status': 'resolved'}, format='json')
        self.assertEqual(today.data['resolved_on'], '2026-11-03')

    def test_dates_are_checked(self, _today) -> None:
        self.assertIn('reported_on', self.create(reported_on='2026-11-04').data)
        repair_id = self.create().data['id']
        early = self.client.patch(
            reverse('repair-detail', args=[repair_id]), {'status': 'resolved', 'resolved_on': '2026-10-01'},
            format='json',
        )
        self.assertIn('resolved_on', early.data)

    def test_status_filter_and_privacy(self, _today) -> None:
        self.create()
        self.create(title='Broken lamp', status='resolved')
        open_only = self.client.get(reverse('repair-list'), {'status': 'open'}).data
        self.assertEqual([item['title'] for item in open_only], ['Leaking tap'])

        repair = RepairRequest.objects.first()
        my_photo = self.client.post(reverse('document-list'), {
            'property': self.home.id, 'kind': 'repair', 'file': image_upload('tap.jpg'),
        }, format='multipart').data['id']
        self.as_other()
        self.assertEqual(self.client.get(reverse('repair-list')).data, [])
        self.assertEqual(self.client.get(reverse('repair-detail', args=[repair.id])).status_code, 404)
        other_home = self.make_property(self.other)
        stolen = self.client.post(reverse('repair-list'), {
            'property': other_home.id, 'title': 'Mine now', 'photo': my_photo,
        }, format='json')
        self.assertIn('photo', stolen.data)
