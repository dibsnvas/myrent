"""Production settings (Render + Supabase)."""
import os

from settings.base import *  # noqa: F401,F403
from settings.base import ALLOWED_HOSTS, LOGGING
from settings.conf import (
    DB_HOST,
    DB_NAME,
    DB_PASSWORD,
    DB_PORT,
    DB_SSLMODE,
    DB_USER,
    FILE_STORAGE,
    RESEND_API_KEY,
    S3_ACCESS_KEY_ID,
    S3_BUCKET,
    S3_ENDPOINT_URL,
    S3_REGION,
    S3_SECRET_ACCESS_KEY,
)

DEBUG = False

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': DB_NAME,
        'USER': DB_USER,
        'PASSWORD': DB_PASSWORD,
        'HOST': DB_HOST,
        'PORT': DB_PORT,
        'CONN_MAX_AGE': 60,
        'OPTIONS': {'sslmode': DB_SSLMODE},
    }
}

if FILE_STORAGE == 's3':
    DEFAULT_FILE_STORAGE_CONFIG = {
        'BACKEND': 'storages.backends.s3.S3Storage',
        'OPTIONS': {
            'bucket_name': S3_BUCKET,
            'endpoint_url': S3_ENDPOINT_URL,
            'region_name': S3_REGION,
            'access_key': S3_ACCESS_KEY_ID,
            'secret_key': S3_SECRET_ACCESS_KEY,
            'addressing_style': 'path',
            'signature_version': 's3v4',
            'default_acl': None,
            'file_overwrite': False,
        },
    }
elif FILE_STORAGE == 'database':
    DEFAULT_FILE_STORAGE_CONFIG = {'BACKEND': 'apps.rentals.storage.DatabaseStorage'}
else:
    DEFAULT_FILE_STORAGE_CONFIG = {'BACKEND': 'django.core.files.storage.FileSystemStorage'}

STORAGES = {
    'default': DEFAULT_FILE_STORAGE_CONFIG,
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

EMAIL_BACKEND = (
    'apps.rentals.email_backends.ResendEmailBackend'
    if RESEND_API_KEY
    else 'django.core.mail.backends.console.EmailBackend'
)

# Render terminates HTTPS in front of gunicorn and tells us the original scheme in this header.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)
    CSRF_TRUSTED_ORIGINS = [f'https://{RENDER_EXTERNAL_HOSTNAME}']

# Render keeps stdout logs; the disk is wiped on every deploy, so no log file.
LOGGING['root']['handlers'] = ['console']
