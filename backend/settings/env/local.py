"""Local development settings."""
from settings.base import *  # noqa: F401,F403
from settings.base import BASE_DIR

DEBUG = True

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Reminder emails are printed to the runserver console.
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
