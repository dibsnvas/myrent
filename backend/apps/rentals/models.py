"""MyRent data model: everything belongs to a Property, and a Property belongs to one tenant.

Models that have a `property` foreign key avoid the @property decorator: inside the class body the
name `property` refers to the field, not the builtin.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from pathlib import PurePath

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.rentals.constants import (
    ADDRESS_MAX_LENGTH,
    CHOICE_MAX_LENGTH,
    DAY_OF_MONTH_MAX,
    DAY_OF_MONTH_MIN,
    MONEY_DECIMAL_PLACES,
    MONEY_MAX_DIGITS,
    PERSON_NAME_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    READING_DECIMAL_PLACES,
    READING_MAX_DIGITS,
    SHORT_NAME_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    UNIT_MAX_LENGTH,
)

DAY_OF_MONTH_VALIDATORS = [MinValueValidator(DAY_OF_MONTH_MIN), MaxValueValidator(DAY_OF_MONTH_MAX)]
POSITIVE_MONEY_VALIDATORS = [MinValueValidator(Decimal('0.01'))]


class Property(models.Model):
    """A home the user rents (tenant) or rents out (landlord): flat, room or house."""

    class Type(models.TextChoices):
        APARTMENT = 'apartment', 'Apartment'
        ROOM = 'room', 'Room'
        HOUSE = 'house', 'House'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='properties')
    title = models.CharField(max_length=TITLE_MAX_LENGTH)
    address = models.CharField(max_length=ADDRESS_MAX_LENGTH)
    property_type = models.CharField(max_length=CHOICE_MAX_LENGTH, choices=Type.choices, default=Type.APARTMENT)
    # The other side of the lease: the landlord for a tenant, the tenant for a landlord.
    contact_name = models.CharField(max_length=PERSON_NAME_MAX_LENGTH, blank=True)
    contact_phone = models.CharField(max_length=PHONE_MAX_LENGTH, blank=True)
    contact_email = models.EmailField(blank=True)
    meter_reading_day = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=DAY_OF_MONTH_VALIDATORS,
        help_text='Day of the month when meter readings are due.',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name_plural = 'properties'

    def __str__(self) -> str:
        return self.title

    @property
    def active_contract(self) -> Contract | None:
        return self.contracts.filter(status=Contract.Status.ACTIVE).order_by('-start_date').first()


def document_upload_to(instance: Document, filename: str) -> str:
    """Random file name inside the owner's folder, so names never collide or reveal anything."""
    extension = PurePath(filename).suffix.lower()
    return f'users/{instance.property.owner_id}/properties/{instance.property_id}/{uuid.uuid4().hex}{extension}'


class Document(models.Model):
    """Any stored file. One table and one upload pipeline for leases, receipts and photos."""

    class Kind(models.TextChoices):
        LEASE = 'lease', 'Lease'
        RENEWAL = 'renewal', 'Renewal'
        RECEIPT = 'receipt', 'Receipt'
        CONDITION = 'condition', 'Condition photo'
        METER = 'meter', 'Meter photo'
        OTHER = 'other', 'Other'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='documents')
    kind = models.CharField(max_length=CHOICE_MAX_LENGTH, choices=Kind.choices, default=Kind.OTHER)
    file = models.FileField(upload_to=document_upload_to, max_length=255)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=SHORT_NAME_MAX_LENGTH)
    size = models.PositiveIntegerField(help_text='Bytes')
    room = models.CharField(max_length=SHORT_NAME_MAX_LENGTH, blank=True, help_text='Condition photos: which room.')
    description = models.TextField(blank=True)
    taken_on = models.DateField(null=True, blank=True, help_text='Condition photos: when the photo was taken.')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-uploaded_at', '-id')

    def __str__(self) -> str:
        return f'{self.get_kind_display()}: {self.original_name}'


class Contract(models.Model):
    """A lease period. A renewal is a new Contract pointing at the one it replaces."""

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        SUPERSEDED = 'superseded', 'Replaced by renewal'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='contracts')
    previous = models.OneToOneField(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='renewal',
        help_text='The contract this one renews.',
    )
    start_date = models.DateField()
    end_date = models.DateField()
    monthly_rent = models.DecimalField(
        max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, validators=POSITIVE_MONEY_VALIDATORS
    )
    rent_due_day = models.PositiveSmallIntegerField(validators=DAY_OF_MONTH_VALIDATORS)
    deposit = models.DecimalField(
        max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, null=True, blank=True
    )
    terms = models.TextField(blank=True, help_text='Key terms: who pays utilities, notice period, rent increases.')
    document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    status = models.CharField(max_length=CHOICE_MAX_LENGTH, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-start_date', '-id')

    def __str__(self) -> str:
        return f'{self.property} · {self.start_date:%d.%m.%Y}–{self.end_date:%d.%m.%Y}'


class Utility(models.Model):
    """A utility category the tenant tracks for this home: electricity, water, internet..."""

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='utilities')
    name = models.CharField(max_length=SHORT_NAME_MAX_LENGTH)
    unit = models.CharField(max_length=UNIT_MAX_LENGTH, blank=True, help_text='kWh, m³, Gcal...')
    has_meter = models.BooleanField(default=False)

    class Meta:
        ordering = ('name',)
        verbose_name_plural = 'utilities'
        constraints = [
            models.UniqueConstraint(fields=('property', 'name'), name='unique_utility_name_per_property'),
        ]

    def __str__(self) -> str:
        return self.name


class Payment(models.Model):
    """Money the tenant owes: monthly rent (generated from the contract), utility bills, anything else."""

    class Kind(models.TextChoices):
        RENT = 'rent', 'Rent'
        UTILITY = 'utility', 'Utility bill'
        OTHER = 'other', 'Other'

    class Status(models.TextChoices):
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'
        DUE = 'due', 'Due'

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='payments')
    contract = models.ForeignKey(Contract, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    utility = models.ForeignKey(Utility, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    kind = models.CharField(max_length=CHOICE_MAX_LENGTH, choices=Kind.choices, default=Kind.OTHER)
    title = models.CharField(max_length=TITLE_MAX_LENGTH, blank=True)
    period = models.DateField(null=True, blank=True, help_text='First day of the month this payment covers.')
    amount = models.DecimalField(
        max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, validators=POSITIVE_MONEY_VALIDATORS
    )
    due_date = models.DateField()
    paid_on = models.DateField(null=True, blank=True)
    note = models.TextField(blank=True)
    receipt = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('due_date', 'id')
        indexes = [models.Index(fields=('property', 'due_date'))]

    def __str__(self) -> str:
        return f'{self.display_title()} · {self.due_date:%d.%m.%Y}'

    def display_title(self) -> str:
        if self.title:
            return self.title
        if self.kind == self.Kind.RENT:
            return 'Rent'
        if self.kind == self.Kind.UTILITY and self.utility_id:
            return f'{self.utility.name} bill'
        return self.get_kind_display()

    def get_status(self, today: date | None = None) -> str:
        if self.paid_on:
            return self.Status.PAID
        today = today or timezone.localdate()
        return self.Status.OVERDUE if self.due_date < today else self.Status.DUE


class MeterReading(models.Model):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='meter_readings')
    utility = models.ForeignKey(Utility, on_delete=models.CASCADE, related_name='readings')
    value = models.DecimalField(max_digits=READING_MAX_DIGITS, decimal_places=READING_DECIMAL_PLACES)
    reading_date = models.DateField()
    photo = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-reading_date', '-id')

    def __str__(self) -> str:
        return f'{self.utility} {self.value} on {self.reading_date:%d.%m.%Y}'


class ReminderLog(models.Model):
    """Which reminders were already emailed, so re-running the daily cron never sends twice."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reminder_logs')
    key = models.CharField(max_length=TITLE_MAX_LENGTH)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('user', 'key'), name='unique_reminder_per_user'),
        ]

    def __str__(self) -> str:
        return f'{self.user} · {self.key}'


class StoredFile(models.Model):
    """File bytes for DatabaseStorage (MYRENT_FILE_STORAGE=database): uploads live in Postgres, no extra service."""

    name = models.CharField(max_length=255, unique=True)
    content = models.BinaryField()
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name
