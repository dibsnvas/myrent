"""Reads settings/.env via python-decouple and exports config variables.

Real environment variables win over the .env file, so on Render you set the same
names in the dashboard and there is no .env file at all.
"""
from pathlib import Path

from decouple import AutoConfig, Csv

SETTINGS_DIR = Path(__file__).resolve().parent

config = AutoConfig(search_path=SETTINGS_DIR)

ENV_ID: str = config('MYRENT_ENV_ID', default='local')
SECRET_KEY: str = config('MYRENT_SECRET_KEY')
ALLOWED_HOSTS: list[str] = config('MYRENT_ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())
CORS_ALLOWED_ORIGINS: list[str] = config('MYRENT_CORS_ALLOWED_ORIGINS', default='http://localhost:5173', cast=Csv())
FRONTEND_URL: str = config('MYRENT_FRONTEND_URL', default='http://localhost:5173')

# Shared secret the daily GitHub Actions cron sends to /api/internal/send-reminders/.
CRON_SECRET: str = config('MYRENT_CRON_SECRET', default='')

DB_NAME: str = config('MYRENT_DB_NAME', default='postgres')
DB_USER: str = config('MYRENT_DB_USER', default='postgres')
DB_PASSWORD: str = config('MYRENT_DB_PASSWORD', default='')
DB_HOST: str = config('MYRENT_DB_HOST', default='localhost')
DB_PORT: int = config('MYRENT_DB_PORT', default=5432, cast=int)
DB_SSLMODE: str = config('MYRENT_DB_SSLMODE', default='require')

# Private file bucket (Supabase Storage speaks the S3 protocol). Off = files go to backend/media/.
USE_S3: bool = config('MYRENT_USE_S3', default=False, cast=bool)
S3_BUCKET: str = config('MYRENT_S3_BUCKET', default='')
S3_ENDPOINT_URL: str = config('MYRENT_S3_ENDPOINT_URL', default='')
S3_REGION: str = config('MYRENT_S3_REGION', default='')
S3_ACCESS_KEY_ID: str = config('MYRENT_S3_ACCESS_KEY_ID', default='')
S3_SECRET_ACCESS_KEY: str = config('MYRENT_S3_SECRET_ACCESS_KEY', default='')

# Reminder emails go through Resend's HTTP API (free Render services block SMTP ports).
EMAIL_FROM: str = config('MYRENT_EMAIL_FROM', default='MyRent <onboarding@resend.dev>')
RESEND_API_KEY: str = config('MYRENT_RESEND_API_KEY', default='')
