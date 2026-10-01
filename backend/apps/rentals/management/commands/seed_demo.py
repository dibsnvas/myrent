"""Create a demo tenant with three months of history, for the demo and for QA.

    python manage.py seed_demo          # create it (skips if it exists)
    python manage.py seed_demo --reset  # delete and recreate it

The account is a test account. It holds only made-up data.
"""
from __future__ import annotations

import io
from datetime import date, timedelta
from decimal import Decimal

from PIL import Image, ImageDraw, ImageFont

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.auths.models import User
from apps.rentals.models import Contract, Document, MeterReading, Payment, Property, Utility
from apps.rentals.services.schedule import add_months, sync_rent_schedule

DEMO_EMAIL = 'demo@myrent.test'
DEMO_PASSWORD = 'myrent-demo-2026'

RENT = Decimal('250000')
RENT_DUE_DAY = 5
METER_DAY = 25
BILL_DUE_DAY = 20
CONDITION_ROOMS = (
    ('Kitchen', 'Small scratch on the worktop left of the sink. Oven and hob work.', (214, 196, 168)),
    ('Bathroom', 'Crack in one wall tile above the bath. Tap drips slightly.', (176, 205, 214)),
    ('Living room', 'Sofa in good condition. Stain on the carpet near the balcony door.', (196, 214, 176)),
)


def _image(text: str, colour: tuple[int, int, int], size: tuple[int, int] = (1200, 900)) -> bytes:
    image = Image.new('RGB', size, colour)
    draw = ImageDraw.Draw(image)
    draw.text((60, 60), text, fill=(40, 40, 40), font=ImageFont.load_default(size=64))
    draw.text((60, 160), 'MyRent demo photo', fill=(70, 70, 70), font=ImageFont.load_default(size=32))
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=85)
    return buffer.getvalue()


def _lease_pdf(prop: Property, start: date, end: date) -> bytes:
    page = Image.new('RGB', (1240, 1754), 'white')  # A4 at 150 dpi
    draw = ImageDraw.Draw(page)
    title_font = ImageFont.load_default(size=44)
    body_font = ImageFont.load_default(size=28)
    lines = [
        f'Address: {prop.address}',
        f'Landlord: {prop.landlord_name}',
        f'Term: {start:%d.%m.%Y} - {end:%d.%m.%Y}',
        f'Monthly rent: {RENT:,.0f} KZT, due on day {RENT_DUE_DAY} of each month'.replace(',', ' '),
        f'Deposit: {RENT:,.0f} KZT'.replace(',', ' '),
        'Utilities: paid by the tenant according to the bills.',
        'Notice period: 30 days for either side.',
        '',
        'DEMO DOCUMENT - not a real contract.',
    ]
    draw.text((100, 120), 'Residential lease agreement', fill='black', font=title_font)
    for index, line in enumerate(lines):
        draw.text((100, 240 + index * 56), line, fill='black', font=body_font)
    buffer = io.BytesIO()
    page.save(buffer, format='PDF', resolution=150)
    return buffer.getvalue()


def _document(prop: Property, kind: str, name: str, data: bytes, content_type: str, **fields) -> Document:
    document = Document(
        property=prop, kind=kind, original_name=name, content_type=content_type, size=len(data), **fields
    )
    document.file.save(name, ContentFile(data), save=False)
    document.save()
    return document


class Command(BaseCommand):
    help = f'Create the demo tenant {DEMO_EMAIL} with a home, lease, payments, meter readings and photos.'

    def add_arguments(self, parser) -> None:
        parser.add_argument('--reset', action='store_true', help='Delete the demo tenant first.')

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        existing = User.objects.filter(email=DEMO_EMAIL).first()
        if existing and not options['reset']:
            self.stdout.write(f'{DEMO_EMAIL} already exists. Use --reset to recreate it.')
            return
        if existing:
            existing.delete()

        today = timezone.localdate()
        user = User.objects.create_user(
            DEMO_EMAIL, DEMO_PASSWORD, first_name='Demo', last_name='Tenant', consent_given_at=timezone.now()
        )
        prop = Property.objects.create(
            owner=user,
            title='Flat on Abay',
            address='Abay Ave 150, apt 42, Almaty',
            property_type=Property.Type.APARTMENT,
            landlord_name='Serik K.',
            landlord_phone='+7 701 000 00 00',
            meter_reading_day=METER_DAY,
            notes='Keys: 2 sets. Intercom code 42.',
        )

        start = add_months(today.replace(day=RENT_DUE_DAY), -3)
        end = add_months(start, 12) - timedelta(days=1)
        lease = _document(prop, Document.Kind.LEASE, 'lease-agreement.pdf', _lease_pdf(prop, start, end),
                          'application/pdf')
        contract = Contract.objects.create(
            property=prop, start_date=start, end_date=end, monthly_rent=RENT, rent_due_day=RENT_DUE_DAY,
            deposit=RENT, terms='Utilities paid by the tenant. 30 days notice. Rent fixed for 12 months.',
            document=lease,
        )
        sync_rent_schedule(contract)
        past_rent = list(contract.payments.filter(due_date__lt=today).order_by('due_date'))
        # Leave the most recent past rent unpaid, so the demo shows an overdue reminder.
        for payment in past_rent[:-1]:
            payment.paid_on = payment.due_date - timedelta(days=1)
            payment.save(update_fields=['paid_on'])

        electricity = Utility.objects.create(property=prop, name='Electricity', unit='kWh', has_meter=True)
        water = Utility.objects.create(property=prop, name='Cold water', unit='m³', has_meter=True)
        internet = Utility.objects.create(property=prop, name='Internet', has_meter=False)

        electricity_value, water_value = Decimal('10450'), Decimal('312.400')
        for months_ago in (3, 2, 1):
            month = add_months(today.replace(day=1), -months_ago)
            electricity_value += Decimal(150 + months_ago * 12)
            water_value += Decimal('6.300')
            reading_day = month.replace(day=METER_DAY)
            MeterReading.objects.create(property=prop, utility=electricity, value=electricity_value,
                                        reading_date=reading_day)
            MeterReading.objects.create(property=prop, utility=water, value=water_value, reading_date=reading_day)
            bill_due = add_months(month, 1).replace(day=BILL_DUE_DAY)
            for utility, amount in ((electricity, 7200 + months_ago * 350), (water, 2900), (internet, 7990)):
                Payment.objects.create(
                    property=prop, kind=Payment.Kind.UTILITY, utility=utility, period=month,
                    amount=Decimal(amount), due_date=bill_due,
                    paid_on=bill_due - timedelta(days=2) if bill_due < today else None,
                )

        for room, description, colour in CONDITION_ROOMS:
            _document(
                prop, Document.Kind.CONDITION, f'{room.lower().replace(" ", "-")}.jpg', _image(room, colour),
                'image/jpeg', room=room, description=description, taken_on=start,
            )

        self.stdout.write(self.style.SUCCESS(
            f'Demo tenant ready: {DEMO_EMAIL} (password in apps/rentals/management/commands/seed_demo.py)'
        ))
