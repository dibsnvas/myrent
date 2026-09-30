from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.rentals.services.notify import send_reminder_emails


class Command(BaseCommand):
    help = 'Email every tenant the reminders they have not been emailed about yet.'

    def handle(self, *args, **options) -> None:
        sent = send_reminder_emails(timezone.localdate())
        self.stdout.write(self.style.SUCCESS(f'Reminder emails sent: {sent}'))
