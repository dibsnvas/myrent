# MyRent v1

Tenant-side rental management: one place for the lease, rent, utility bills, meter readings,
move-in condition photos and reminders. Course project for IT Project Management (PjM 101), Fall 2026.

```
React (Vite) on Vercel  ->  Django + DRF API on Render  ->  Supabase: Postgres + private file bucket
                                    ^
                     GitHub Actions daily cron (reminder emails via Resend)
```

## What v1 covers (all 8 Must features)

| Must feature (TSIS 1-2) | Where |
|---|---|
| Registration and login | Email + password, JWT. Sign-up records consent. `/register`, `/login` |
| Rental property profile | Address, type, landlord contacts, meter-reading day. Add-home wizard, "Edit home" |
| Contract details and upload | Dates, rent, due day, deposit, key terms, lease file. Saving a lease creates one rent payment per month |
| Rent payment tracker | Payments page: mark paid/unpaid, statuses due / overdue / paid, receipts |
| Utility and meter records | Utility categories (add/delete), bills, meter readings with consumption |
| Contract renewal | "Renew" creates a new lease linked to the old one. History and paid rent stay |
| Calendar and reminders | Month calendar plus a reminders banner (overdue, due in 3 days, meter day, lease ending). Daily email digest |
| Condition photo log | Dated photos per room with descriptions. Location data stripped on upload |

Not in v1 (Should/Could): contract amendments, maintenance issue log, monthly expense summary,
AI contract assistant, landlord accounts.

## Project layout

```
backend/                Django 5.2 LTS, same conventions as blog-api
  apps/auths/           custom User (email login, consent timestamp), register/login/me
  apps/rentals/         Property, Contract, Payment, Utility, MeterReading, Document, ReminderLog
    ownership.py        the privacy rule: every query is limited to the logged-in tenant
    services/           rent schedule, calendar + reminders, uploads + signed links, reminder email
    management/commands seed_demo, send_reminders
    tests/              ownership, contracts/renewal, payments, documents, reminders
  settings/             base.py + env/local.py (SQLite) + env/prod.py (Supabase, S3, Resend)
frontend/               React 19 + Vite, Mantine UI, TanStack Query, React Router
  src/api/              axios client (JWT refresh), query hooks
  src/pages/            Login, Register, NewHome (wizard), Dashboard, Payments, Utilities, Documents, Account
render.yaml             Render Blueprint for the API
.github/workflows/      daily reminder cron
```

## Run locally

Backend (Python 3.12):

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cp settings/.env.example settings/.env   # then put any long random string in MYRENT_SECRET_KEY
python manage.py migrate
python manage.py seed_demo               # demo tenant with 3 months of history
python manage.py runserver
```

Frontend (Node 20+), in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` to Django on port 8000.

- Demo login: `demo@myrent.test`. The password is `DEMO_PASSWORD` in
  `backend/apps/rentals/management/commands/seed_demo.py`. Run `seed_demo --reset` to get fresh demo data.
- API docs (Swagger, for Amina's test cases): http://localhost:8000/api/docs/. Click "Authorize" and paste
  the `access` token from `POST /api/auth/login/`.
- Admin: `python manage.py createsuperuser`, then http://localhost:8000/admin/.
- Reminder emails locally: `python manage.py send_reminders` prints them to the console.

Checks:

```bash
cd backend && python manage.py test && ruff check .
cd frontend && npm run lint && npm run build
```

## Deploy (free tier, about 30 minutes)

1. **GitHub**: push this folder as one repository.
2. **Supabase** (database + files): create a project in region `eu-central-1`.
   - Project Settings -> Database -> Connection string -> **Session pooler** (IPv4; Render has no IPv6).
     It gives host, user (`postgres.<project-ref>`) and password.
   - Storage -> New bucket `documents`, **private**. Storage -> S3 Connection -> copy endpoint and
     region, create an access key.
3. **Render** (API): New -> Blueprint -> this repo. Fill in the `sync: false` values: Supabase DB host,
   user and password; S3 endpoint, region and keys. Leave the two Vercel URLs as placeholders for now.
   When it is live, open `https://<name>.onrender.com/api/health/`.
4. **Vercel** (frontend): New project -> this repo -> Root directory `frontend`, framework Vite.
   Environment variable `VITE_API_URL=https://<name>.onrender.com`. Deploy.
5. Back on Render, set `MYRENT_CORS_ALLOWED_ORIGINS` and `MYRENT_FRONTEND_URL` to the Vercel URL.
6. Optional emails: create a resend.com API key and set `MYRENT_RESEND_API_KEY` on Render. Without it,
   reminders still show in the app and the emails are only printed to Render's log.
7. **Cron**: in GitHub -> Settings -> Secrets -> Actions add `MYRENT_API_URL` (the Render URL) and
   `MYRENT_CRON_SECRET` (copy it from Render's environment). Actions -> Daily reminders -> Run workflow
   to test it.
8. Demo data on production: Render -> Shell -> `python manage.py seed_demo`.

Free-tier facts that shaped this setup:
- **Render sleeps after 15 minutes idle** and takes about a minute to wake. Open the site a few minutes
  before the demo.
- **Render's disk is wiped on every deploy**, so files go to Supabase Storage.
- **Render's free Postgres expires after 30 days**, so the database is on Supabase.
- **Render's free tier blocks SMTP ports**, so email goes through Resend's HTTP API.
- **Supabase pauses a project after 7 idle days.** The daily cron touches the database, which keeps it awake.

## Design decisions

- **Privacy by construction.** `OwnedQuerysetMixin` and `OwnedPrimaryKeyRelatedField`
  (`apps/rentals/ownership.py`) limit every read and every linked id to the logged-in tenant. Another
  tenant's id behaves like one that doesn't exist (404 / "Invalid pk"). Tested in `test_ownership.py`.
- **Reminders are calculated, not scheduled.** `services/events.py` works out what is overdue or due soon
  on every request, so there is no Celery, no Redis and no worker. The cron only emails the same list.
  `ReminderLog` makes sure each reminder is emailed once.
- **One `Payment` table** for rent, utility bills and other costs. The calendar and a future monthly
  summary are each one query.
- **Renewal = new `Contract` row** pointing at the previous one. Paid history is never rewritten. Unpaid
  rent inside the new period moves to the new terms.
- **One upload pipeline** (`services/uploads.py`):
  - Checks the real file type (PDF header, or Pillow for images), not the extension.
  - Limits: PDF up to 10 MB, images up to 5 MB.
  - Strips EXIF/GPS from photos (rotation kept), and saves the camera date as the photo date.
  - Random file names.
  - Files are never public. The API hands out signed links that expire after 10 minutes.

## Known trade-offs (for the personal-data note)

- **JWT tokens are kept in `localStorage`.** Simple for an MVP, but readable by injected scripts. The
  alternative is httpOnly cookies, which need same-site hosting.
- **Hosting is outside Kazakhstan.** Kazakhstan's personal-data law expects citizens' data to be stored
  in the country. That is fine for a course demo with test data, but a real launch needs Kazakhstan-hosted
  storage.
- **Deleting an account removes everything**, including files: the Document `post_delete` signal deletes
  them from storage.
