"""All properties at a glance: the landlord's home screen (works for a tenant with several homes too)."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from apps.auths.models import User
from apps.rentals.constants import CONTRACT_END_WARNING_DAYS
from apps.rentals.models import Contract, Payment, Property
from apps.rentals.services.events import month_bounds


def _money(value: Decimal) -> str:
    return f'{value:.2f}'


def _month_status(rent_this_month: list[Payment], today: date) -> str:
    """'none' (no rent due this month), 'paid', 'overdue' or 'due'."""
    if not rent_this_month:
        return 'none'
    unpaid = [payment for payment in rent_this_month if not payment.paid_on]
    if not unpaid:
        return Payment.Status.PAID
    return Payment.Status.OVERDUE if any(p.due_date < today for p in unpaid) else Payment.Status.DUE


def portfolio_overview(user: User, today: date) -> dict[str, Any]:
    first, last = month_bounds(today.replace(day=1))
    properties = list(Property.objects.filter(owner=user).order_by('title'))
    contracts = {
        contract.property_id: contract
        for contract in Contract.objects.filter(property__in=properties, status=Contract.Status.ACTIVE)
        .order_by('start_date')
    }
    rent = list(Payment.objects.filter(property__in=properties, kind=Payment.Kind.RENT).order_by('due_date'))

    rows = []
    totals = {'expected': Decimal(0), 'received': Decimal(0), 'overdue': Decimal(0), 'overdue_count': 0, 'leased': 0}
    for prop in properties:
        own_rent = [payment for payment in rent if payment.property_id == prop.id]
        this_month = [payment for payment in own_rent if first <= payment.due_date <= last]
        overdue = [payment for payment in own_rent if not payment.paid_on and payment.due_date < today]
        upcoming = [payment for payment in own_rent if not payment.paid_on and payment.due_date >= today]
        contract = contracts.get(prop.id)
        lease_active = contract is not None and contract.end_date >= today

        month_amount = sum((payment.amount for payment in this_month), Decimal(0))
        month_paid = sum((payment.amount for payment in this_month if payment.paid_on), Decimal(0))
        overdue_amount = sum((payment.amount for payment in overdue), Decimal(0))
        totals['expected'] += month_amount
        totals['received'] += month_paid
        totals['overdue'] += overdue_amount
        totals['overdue_count'] += len(overdue)
        totals['leased'] += int(lease_active)

        rows.append({
            'id': prop.id,
            'title': prop.title,
            'address': prop.address,
            'contact_name': prop.contact_name,
            'contact_phone': prop.contact_phone,
            'monthly_rent': _money(contract.monthly_rent) if contract else None,
            'lease_end': contract.end_date if contract else None,
            'lease_ends_soon': bool(
                contract and contract.end_date <= today + timedelta(days=CONTRACT_END_WARNING_DAYS)
            ),
            'month_status': _month_status(this_month, today),
            'month_amount': _money(month_amount),
            'overdue_count': len(overdue),
            'overdue_total': _money(overdue_amount),
            'next_due': upcoming[0].due_date if upcoming else None,
        })

    return {
        'month': f'{today:%Y-%m}',
        'properties': rows,
        'totals': {
            'properties': len(properties),
            'leased': totals['leased'],
            'month_expected': _money(totals['expected']),
            'month_received': _money(totals['received']),
            'overdue_total': _money(totals['overdue']),
            'overdue_count': totals['overdue_count'],
        },
    }
