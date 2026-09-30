"""Daily reminder email. Triggered by the GitHub Actions cron or `manage.py send_reminders`."""
from __future__ import annotations

import logging
from datetime import date

from django.conf import settings
from django.core.mail import send_mail

from apps.auths.models import User
from apps.rentals.models import ReminderLog
from apps.rentals.services.events import Reminder, reminders_for

logger = logging.getLogger(__name__)


def _email_body(user: User, reminders: list[Reminder]) -> str:
    lines = [f'Hi {user.first_name},', '', 'Here is what needs your attention in MyRent:', '']
    for reminder in reminders:
        amount = f' · {reminder.amount:,.0f} ₸'.replace(',', ' ') if reminder.amount else ''
        lines.append(f'• {reminder.title} ({reminder.date:%d.%m.%Y}) · {reminder.property_title}{amount}')
    lines += ['', f'Open MyRent: {settings.FRONTEND_URL}', '', 'You get this email because you have a MyRent account.']
    return '\n'.join(lines)


def send_reminder_emails(today: date) -> int:
    """Email each tenant the reminders they have not been emailed about yet. Returns emails sent."""
    sent = 0
    users = User.objects.filter(is_active=True, properties__isnull=False).distinct()
    for user in users:
        reminders = reminders_for(user, today)
        if not reminders:
            continue
        already_sent = set(
            ReminderLog.objects.filter(user=user, key__in=[r.key for r in reminders]).values_list('key', flat=True)
        )
        fresh = [r for r in reminders if r.key not in already_sent]
        if not fresh:
            continue
        subject = 'MyRent: 1 thing needs your attention' if len(fresh) == 1 else (
            f'MyRent: {len(fresh)} things need your attention'
        )
        try:
            send_mail(subject, _email_body(user, fresh), None, [user.email])
        except Exception:
            # Not logged as sent, so tomorrow's run retries this user.
            logger.exception('Reminder email to user %s failed', user.pk)
            continue
        ReminderLog.objects.bulk_create([ReminderLog(user=user, key=r.key) for r in fresh], ignore_conflicts=True)
        sent += 1
    return sent
