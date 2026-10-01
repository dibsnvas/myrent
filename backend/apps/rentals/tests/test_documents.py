from unittest import mock

from PIL import Image

from rest_framework import status

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from apps.rentals.models import Document, StoredFile
from apps.rentals.tests.base import RentalsTestCase, image_upload, pdf_upload


def exif_with_gps_and_date() -> bytes:
    exif = Image.Exif()
    exif[0x0132] = '2026:09:14 10:00:00'  # DateTime
    exif[0x8825] = {1: 'N', 2: (43.0, 14.0, 0.0)}  # GPSInfo: latitude
    return exif.tobytes()


class UploadTests(RentalsTestCase):
    def upload(self, file, **fields):
        return self.client.post(
            reverse('document-list'), {'property': self.home.id, 'kind': 'condition', 'file': file, **fields},
            format='multipart',
        )

    def test_photo_upload_strips_gps_and_keeps_date(self) -> None:
        response = self.upload(image_upload(exif=exif_with_gps_and_date()), room='Kitchen')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['taken_on'], '2026-09-14')
        self.assertTrue(response.data['is_image'])
        document = Document.objects.get()
        with Image.open(document.file.path) as stored:
            self.assertNotIn(0x8825, stored.getexif())
        self.assertTrue(document.file.name.startswith(f'users/{self.user.id}/properties/{self.home.id}/'))
        self.assertNotIn('photo', document.file.name)  # random name, not the user's file name

    def test_pdf_upload_and_signed_link(self) -> None:
        response = self.upload(pdf_upload(), kind='lease')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['content_type'], 'application/pdf')

        self.client.force_authenticate(None)  # the link itself is the permission
        file_response = self.client.get(response.data['url'])
        self.assertEqual(file_response.status_code, status.HTTP_200_OK)
        self.assertEqual(file_response['Content-Type'], 'application/pdf')
        self.assertTrue(b''.join(file_response.streaming_content).startswith(b'%PDF-'))

        tampered = response.data['url'].rstrip('/')[:-3] + 'abc/'
        self.assertEqual(self.client.get(tampered).status_code, status.HTTP_404_NOT_FOUND)

    def test_fake_pdf_and_html_are_rejected(self) -> None:
        fake = SimpleUploadedFile('lease.pdf', b'<html>not a pdf</html>', content_type='application/pdf')
        response = self.upload(fake)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('file', response.data)
        self.assertFalse(Document.objects.exists())

    @mock.patch('apps.rentals.services.uploads.UPLOAD_MAX_PDF_BYTES', 2000)
    def test_size_limits(self) -> None:
        response = self.upload(pdf_upload(size=3000))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('MB', str(response.data['file']))

    def test_deleting_document_removes_file(self) -> None:
        document_id = self.upload(image_upload(image_format='PNG', name='x.png')).data['id']
        path = Document.objects.get(pk=document_id).file.path
        self.client.delete(reverse('document-detail', args=[document_id]))
        with self.assertRaises(FileNotFoundError):
            open(path, 'rb')

    def test_other_tenant_cannot_list_my_documents(self) -> None:
        self.upload(pdf_upload())
        self.as_other()
        self.assertEqual(self.client.get(reverse('document-list')).data, [])


DATABASE_STORAGES = {
    'default': {'BACKEND': 'apps.rentals.storage.DatabaseStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


@override_settings(STORAGES=DATABASE_STORAGES)
class DatabaseStorageTests(RentalsTestCase):
    """Production on free Render keeps file bytes in Postgres (MYRENT_FILE_STORAGE=database)."""

    def test_upload_download_delete_in_database(self) -> None:
        response = self.client.post(
            reverse('document-list'),
            {'property': self.home.id, 'kind': 'lease', 'file': pdf_upload(size=4000)},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        stored = StoredFile.objects.get()
        self.assertEqual(stored.size, 4000)

        self.client.force_authenticate(None)
        file_response = self.client.get(response.data['url'])
        self.assertEqual(file_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(b''.join(file_response.streaming_content)), 4000)

        self.client.force_authenticate(self.user)
        self.client.delete(reverse('document-detail', args=[response.data['id']]))
        self.assertFalse(StoredFile.objects.exists())
