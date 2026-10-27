"""Monthly housing cost (US-11): rent, utility bills and other payments due in one month, added up."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any

from apps.rentals.models import Payment, Property
from apps.rentals.services.events import month_bounds


def _money(value: Decimal) -> str:
    return f'{value:.2f}'


def month_summary(prop: Property, month_start: date) -> dict[str, Any]:
    """Payments are counted in the month they are due, the same rule as the Payments list and the calendar."""
    payments = prop.payments.filter(due_date__range=month_bounds(month_start)).select_related('utility')
    by_kind: dict[str, Decimal] = defaultdict(Decimal)
    by_utility: dict[str, Decimal] = defaultdict(Decimal)
    paid = Decimal(0)
    for payment in payments:
        by_kind[payment.kind] += payment.amount
        if payment.kind == Payment.Kind.UTILITY:
            # A bill keeps its amount when its utility category is deleted; show it under its own title then.
            name = payment.utility.name if payment.utility else payment.display_title()
            by_utility[name] += payment.amount
        if payment.paid_on:
            paid += payment.amount
    total = sum(by_kind.values(), Decimal(0))
    return {
        'month': f'{month_start:%Y-%m}',
        'rent': _money(by_kind[Payment.Kind.RENT]),
        'utilities': _money(by_kind[Payment.Kind.UTILITY]),
        'other': _money(by_kind[Payment.Kind.OTHER]),
        'total': _money(total),
        'paid': _money(paid),
        'left': _money(total - paid),
        'utilities_by_name': [
            {'name': name, 'amount': _money(amount)}
            for name, amount in sorted(by_utility.items(), key=lambda item: (-item[1], item[0]))
        ],
    }
