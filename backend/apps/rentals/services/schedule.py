"""Rent schedule: a contract owns one unpaid Payment row per month until it is paid."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction

from apps.rentals.models import Contract, Document, Payment


def add_months(day: date, months: int) -> date:
    """Same day `months` later; day must be <= 28 (all due days are)."""
    month_index = day.month - 1 + months
    return day.replace(year=day.year + month_index // 12, month=month_index % 12 + 1)


def months_between(start: date, end: date) -> int:
    return (end.year - start.year) * 12 + (end.month - start.month)


def rent_due_dates(start: date, end: date, due_day: int) -> list[date]:
    """Every date whose day is `due_day`, from start to end inclusive."""
    current = date(start.year, start.month, due_day)
    dates = []
    while current <= end:
        if current >= start:
            dates.append(current)
        current = add_months(current, 1)
    return dates


@transaction.atomic
def sync_rent_schedule(contract: Contract) -> None:
    """Make the contract's unpaid rent rows match its dates and amount. Paid rows are history and stay."""
    contract.payments.filter(kind=Payment.Kind.RENT, paid_on__isnull=True).delete()
    paid_dates = set(contract.payments.filter(kind=Payment.Kind.RENT).values_list('due_date', flat=True))
    Payment.objects.bulk_create(
        Payment(
            property=contract.property,
            contract=contract,
            kind=Payment.Kind.RENT,
            period=due.replace(day=1),
            amount=contract.monthly_rent,
            due_date=due,
        )
        for due in rent_due_dates(contract.start_date, contract.end_date, contract.rent_due_day)
        if due not in paid_dates
    )


@transaction.atomic
def renew_contract(
    old: Contract,
    *,
    start_date: date,
    end_date: date,
    monthly_rent: Decimal,
    rent_due_day: int,
    deposit: Decimal | None,
    terms: str,
    document: Document | None,
) -> Contract:
    """Record a new lease period. The old contract and its paid history stay untouched."""
    new = Contract.objects.create(
        property=old.property,
        previous=old,
        start_date=start_date,
        end_date=end_date,
        monthly_rent=monthly_rent,
        rent_due_day=rent_due_day,
        deposit=deposit,
        terms=terms,
        document=document,
    )
    old.status = Contract.Status.SUPERSEDED
    old.save(update_fields=['status'])
    # Unpaid rent of the old lease inside the new period would otherwise be charged twice.
    old.payments.filter(kind=Payment.Kind.RENT, paid_on__isnull=True, due_date__gte=start_date).delete()
    sync_rent_schedule(new)
    return new


@transaction.atomic
def delete_contract(contract: Contract) -> None:
    """Delete a contract; if it was a renewal, the lease it replaced becomes active again."""
    contract.payments.filter(kind=Payment.Kind.RENT, paid_on__isnull=True).delete()
    previous = contract.previous
    contract.delete()
    if previous:
        previous.status = Contract.Status.ACTIVE
        previous.save(update_fields=['status'])
        sync_rent_schedule(previous)
