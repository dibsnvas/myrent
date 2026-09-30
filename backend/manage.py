#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

from decouple import AutoConfig

ENV_FILE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'settings')
ENV_ID_VAR = 'MYRENT_ENV_ID'
DEFAULT_ENV_ID = 'local'
ALLOWED_ENV_IDS = ('local', 'prod')


def main() -> None:
    """Pick settings module by MYRENT_ENV_ID from settings/.env and run the command."""
    config = AutoConfig(search_path=ENV_FILE_DIR)
    env_id: str = config(ENV_ID_VAR, default=DEFAULT_ENV_ID)
    if env_id not in ALLOWED_ENV_IDS:
        raise ValueError(f'{ENV_ID_VAR} must be one of {ALLOWED_ENV_IDS}, got {env_id!r}')

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', f'settings.env.{env_id}')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            'available on your PYTHONPATH environment variable? Did you '
            'forget to activate a virtual environment?'
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
