# Email Delivery Setup (SMTP)

The app ships with a `mock` email provider (logs emails, never delivers). To make
emails **actually deliver** during the client demo, switch to SMTP with a free
sandbox account from SendGrid or Brevo.

Both providers offer a free tier with a few hundred emails/day — enough for a demo.

## 1. Choose a provider

| | SendGrid (Twilio) | Brevo (ex-Sendinblue) |
|---|---|---|
| Free tier | 100 emails/day | 300 emails/day |
| SMTP host | `smtp.sendgrid.net` | `smtp-relay.brevo.com` |
| Port / security | 587 + STARTTLS (or 465 SSL) | 587 + STARTTLS (or 465 SSL) |
| Username | literal `apikey` | your SMTP login (email address) |
| Password | the API key (`SG.…`) | the master key / SMTP key |

## 2. Create the sandbox account (one-time, ~10 minutes)

### SendGrid
1. Sign up at https://signup.sendgrid.com (free plan).
2. **Sender Authentication → Single Sender Verification** → add the address you
   will send *from* (must be a real inbox you control; click the verification email).
3. **Settings → API Keys → Create API Key** → restrict to "Mail Send" → copy the
   key (starts with `SG.`). It is shown only once.
4. Recommended: set up **Domain Authentication** if you own a domain, so emails
   aren't flagged as spam. For a quick demo, verified-single-sender is enough.

### Brevo
1. Sign up at https://www.brevo.com (free plan).
2. **Senders & IP → Senders** → add and verify your sender address.
3. **SMTP & API → SMTP** → copy the **SMTP login** (an email) and the **master key**
   (or create an SMTP key). Those are your `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD`.

> Sandbox tip: keep `EMAIL_USE_TLS=True` with port 587 — both providers support it,
> and it's the most firewall-friendly. Port 465 with `EMAIL_USE_SSL=True` also works.

## 3. Configure the backend

Set these in `backend/.env` (or the staging env):

```dotenv
EMAIL_PROVIDER=smtp
EMAIL_HOST=smtp.sendgrid.net          # or smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey                # or your Brevo SMTP login
EMAIL_HOST_PASSWORD=SG.xxxxxxxxxxxx   # or your Brevo master key
EMAIL_TIMEOUT=15
DEFAULT_FROM_EMAIL=you@verified-domain.com   # must be the verified sender!
```

Never commit real credentials — `.env` is gitignored. `backend/.env.example` has
this block as a template.

## 4. Verify delivery

```bash
cd backend
python manage.py send_test_email --to you@example.com            # grade digest
python manage.py send_test_email --to you@example.com --template certificate_issued
```

- Success: prints `Email sent to … via smtp`.
- Failure: prints the SMTP error. The two most common:
  - `550 Unauthenticated senders not allowed` → wrong/empty API key.
  - `553 … sender address rejected` → `DEFAULT_FROM_EMAIL` is not the verified sender.
  - `(530 … authentication)` → wrong username/password pair.

Check the recipient's **spam folder** on the first test.

## 5. How it behaves if SMTP is unconfigured

- `EMAIL_PROVIDER` defaults to `mock` — the app keeps working, emails are captured
  in the mock provider's store (visible in logs) and never leave the machine.
- With `EMAIL_PROVIDER=smtp` but empty credentials, sends fail gracefully:
  the notification is still created, the delivery log records the failure, and the
  app never crashes.
- Tests always use the mock provider regardless of this setting.

## 6. Demo checklist

- [ ] Sandbox account created + sender verified
- [ ] `EMAIL_PROVIDER=smtp` + 4 `EMAIL_*` vars set in the environment
- [ ] `python manage.py send_test_email` arrives in the inbox (not spam)
- [ ] Release a grade in the UI → student/parent receive the branded digest email