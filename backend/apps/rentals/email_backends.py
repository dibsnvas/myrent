"""Django email backend that sends through Resend's HTTP API.

Free Render web services block outbound SMTP ports, so the usual SMTP backend cannot be used there.
"""
from __future__ import annotations

import json
import logging
import urllib.request
from collections.abc import Sequence

from django.conf import settings
from django.core.mail import EmailMessage
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

RESEND_URL = 'https://api.resend.com/emails'
REQUEST_TIMEOUT_SECONDS = 15


class ResendEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages: Sequence[EmailMessage]) -> int:
        sent = 0
        for message in email_messages:
            payload = {
                'from': message.from_email or settings.DEFAULT_FROM_EMAIL,
                'to': list(message.to),
                'subject': message.subject,
                'text': message.body,
            }
            request = urllib.request.Request(
                RESEND_URL,
                data=json.dumps(payload).encode(),
                headers={
                    'Authorization': f'Bearer {settings.RESEND_API_KEY}',
                    'Content-Type': 'application/json',
                },
                method='POST',
            )
            try:
                with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS):
                    sent += 1
            except OSError:
                logger.exception('Resend rejected email to %s', message.to)
                if not self.fail_silently:
                    raise
        return sent
