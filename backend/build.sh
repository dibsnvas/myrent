#!/usr/bin/env bash
# Render build step. Migrations run here because pre-deploy commands are a paid Render feature.
set -o errexit

pip install -r requirements/prod.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Demo tenant for the presentation (skipped if it already exists). Turn off with MYRENT_SEED_DEMO=False.
if [ "${MYRENT_SEED_DEMO:-False}" = "True" ]; then
  python manage.py seed_demo
fi
