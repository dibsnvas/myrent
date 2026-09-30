"""Calendar events and reminders are calculated from the data on every request, never scheduled.

That is what lets the MVP work without Celery, Redis or a background worker: the dashboard banner
is always correct, and the daily email job only re-uses `reminders_for`.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from apps.auths.models import User
from apps.rentals.constants import CONTRACT_END_WARNING_DAYS, REMINDER_DAYS_AHEAD
from apps.rentals.models import Contract, MeterReading, Payment, Property
from apps.rentals.services.schedule import add_months


@dataclass(frozen=True)
class Event:
    date: date
    kind: str  # 'payment' | 'meter_reading' | 'contract_end'
    title: str
    property_id: int
    property_title: str
    object_id: int | None = None
    amount: Decimal | None = None
    status: str = ''


@dataclass(frozen=True)
class Reminder:
    key: str  # stable id; ReminderLog uses it so an email is sent once per reminder
    level: str  # 'overdue' | 'soon' | 'info'
    date: date
    title: str
    property_id: int
    property_title: str
    amount: Decimal | None = None


LEVEL_ORDER = {'overdue': 0, 'soon': 1, 'info': 2}


def month_bounds(month_start: date) -> tuple[date, date]:
    last_day = calendar.monthrange(month_start.year, month_start.month)[1]
    return month_start, month_start.replace(day=last_day)


def _properties(user: User, property_id: int | None) -> list[Property]:
    queryset = Property.objects.filter(owner=user).prefetch_related('utilities')
    if property_id:
        queryset = queryset.filter(pk=property_id)
    return list(queryset)


def _meter_utility_ids(prop: Property) -> set[int]:
    return {utility.id for utility in prop.utilities.all() if utility.has_meter}


def calendar_events(
    user: User, month_start: date, property_id: int | None = None, today: date | None = None
) -> list[Event]:
    first, last = month_bounds(month_start)
    properties = _properties(user, property_id)
    events: list[Event] = []

    payments = Payment.objects.filter(property__in=properties, due_date__range=(first, last)).select_related(
        'property', 'utility'
    )
    for payment in payments:
        events.append(Event(
            date=payment.due_date,
            kind='payment',
            title=payment.display_title(),
            property_id=payment.property_id,
            property_title=payment.property.title,
            object_id=payment.id,
            amount=payment.amount,
            status=payment.get_status(today),
        ))

    for prop in properties:
        if prop.meter_reading_day and _meter_utility_ids(prop):
            events.append(Event(
                date=first.replace(day=prop.meter_reading_day),
                kind='meter_reading',
                title='Submit meter readings',
                property_id=prop.id,
                property_title=prop.title,
            ))

    contracts = Contract.objects.filter(
        property__in=properties, status=Contract.Status.ACTIVE, end_date__range=(first, last)
    ).select_related('property')
    for contract in contracts:
        events.append(Event(
            date=contract.end_date,
            kind='contract_end',
            title='Lease ends',
            property_id=contract.property_id,
            property_title=contract.property.title,
            object_id=contract.id,
        ))

    return sorted(events, key=lambda event: (event.date, event.kind))


def _payment_reminders(properties: list[Property], today: date) -> list[Reminder]:
    soon = today + timedelta(days=REMINDER_DAYS_AHEAD)
    payments = Payment.objects.filter(
        property__in=properties, paid_on__isnull=True, due_date__lte=soon
    ).select_related('property', 'utility')
    reminders = []
    for payment in payments:
        overdue = payment.due_date < today
        if overdue:
            title = f'{payment.display_title()} is overdue'
        elif payment.due_date == today:
            title = f'{payment.display_title()} is due today'
        else:
            title = f'{payment.display_title()} is due soon'
        level = 'overdue' if overdue else 'soon'
        reminders.append(Reminder(
            key=f'payment:{payment.id}:{payment.due_date.isoformat()}:{level}',
            level=level,
            date=payment.due_date,
            title=title,
            property_id=payment.property_id,
            property_title=payment.property.title,
            amount=payment.amount,
        ))
    return reminders


def _recorded_in_month(utility_ids: set[int], day: date) -> set[int]:
    """Meters (utility ids) that have a reading in the same month as `day`."""
    return set(
        MeterReading.objects.filter(
            utility_id__in=utility_ids, reading_date__year=day.year, reading_date__month=day.month
        ).values_list('utility_id', flat=True)
    )


def _meter_reminders(properties: list[Property], today: date) -> list[Reminder]:
    reminders = []
    for prop in properties:
        meter_ids = _meter_utility_ids(prop)
        if not prop.meter_reading_day or not meter_ids:
            continue
        due = today.replace(day=prop.meter_reading_day)
        if due < today and meter_ids <= _recorded_in_month(meter_ids, due):
            due = add_months(due, 1)  # this month is done, look at the next one
        if meter_ids <= _recorded_in_month(meter_ids, due):
            continue
        if due < today:
            level, title = 'overdue', 'Meter readings were not recorded'
        elif (due - today).days <= REMINDER_DAYS_AHEAD:
            level, title = 'soon', 'Meter readings are due'
        else:
            continue
        reminders.append(Reminder(
            key=f'meter:{prop.id}:{due:%Y-%m}:{level}',
            level=level,
            date=due,
            title=title,
            property_id=prop.id,
            property_title=prop.title,
        ))
    return reminders


def _contract_reminders(properties: list[Property], today: date) -> list[Reminder]:
    horizon = today + timedelta(days=CONTRACT_END_WARNING_DAYS)
    contracts = Contract.objects.filter(
        property__in=properties, status=Contract.Status.ACTIVE, end_date__lte=horizon
    ).select_related('property')
    reminders = []
    for contract in contracts:
        ended = contract.end_date < today
        reminders.append(Reminder(
            key=f'contract-end:{contract.id}:{"ended" if ended else "soon"}',
            level='overdue' if ended else 'info',
            date=contract.end_date,
            title='Lease has ended: record the renewal' if ended else 'Lease ends soon',
            property_id=contract.property_id,
            property_title=contract.property.title,
        ))
    return reminders


def reminders_for(user: User, today: date, property_id: int | None = None) -> list[Reminder]:
    properties = _properties(user, property_id)
    if not properties:
        return []
    reminders = (
        _payment_reminders(properties, today)
        + _meter_reminders(properties, today)
        + _contract_reminders(properties, today)
    )
    return sorted(reminders, key=lambda reminder: (LEVEL_ORDER[reminder.level], reminder.date))
