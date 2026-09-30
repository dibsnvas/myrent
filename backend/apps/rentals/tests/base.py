from __future__ import annotations

import io
import shutil
import tempfile
from datetime import date
from decimal import Decimal

from PIL import Image

from rest_framework.test import APITestCase

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from apps.auths.models import User
from apps.rentals.models import Contract, Property
from apps.rentals.services.schedule import sync_rent_schedule

MEDIA_ROOT = tempfile.mkdtemp(prefix='myrent-test-media-')


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class RentalsTestCase(APITestCase):
    """Two tenants, so every test can also check that tenant B never sees tenant A's data."""

    @classmethod
    def tearDownClass(cls) -> None:
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    def setUp(self) -> None:
        self.user = User.objects.create_user('a@example.com', 'pass-for-tests-1', first_name='A')
        self.other = User.objects.create_user('b@example.com', 'pass-for-tests-2', first_name='B')
        self.client.force_authenticate(self.user)
        self.home = self.make_property(self.user)

    def make_property(self, owner: User, **fields) -> Property:
        return Property.objects.create(owner=owner, **({'title': 'Home', 'address': 'Somewhere 1'} | fields))

    def make_contract(self, prop: Property, start: date, end: date, rent: str = '100000', due_day: int = 5) -> Contract:
        contract = Contract.objects.create(
            property=prop, start_date=start, end_date=end, monthly_rent=Decimal(rent), rent_due_day=due_day
        )
        sync_rent_schedule(contract)
        return contract

    def as_other(self) -> None:
        self.client.force_authenticate(self.other)


def image_upload(name: str = 'photo.jpg', image_format: str = 'JPEG', exif: bytes | None = None,
                 size: tuple[int, int] = (40, 30)) -> SimpleUploadedFile:
    buffer = io.BytesIO()
    options = {'exif': exif} if exif else {}
    Image.new('RGB', size, (200, 100, 50)).save(buffer, format=image_format, **options)
    content_type = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}[image_format]
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


def pdf_upload(name: str = 'lease.pdf', size: int = 1000) -> SimpleUploadedFile:
    body = b'%PDF-1.4\n' + b'0' * max(size - 9, 0)
    return SimpleUploadedFile(name, body, content_type='application/pdf')
