# SSB Group website

Static marketing site for SSB Group, deployed on Vercel. Contact and newsletter
forms send real email through Hostinger SMTP using Vercel serverless functions.

## Forms

| Form | Page section | Endpoint | What happens |
| --- | --- | --- | --- |
| Get in touch | `#contact` | `POST /api/contact` | Sends the enquiry to `info@ssbgroups.in` with the visitor's email as Reply-To. |
| Newsletter | Footer | `POST /api/subscribe` | Notifies `info@ssbgroups.in` and sends a welcome email to the subscriber. |

Both forms keep the old `mailto:` action as a no-JavaScript fallback, but normal
submissions are handled by `js/forms.js` and the API routes. The Get in touch
form validates the name, email, phone number and message inline before sending,
and the server repeats the same checks.

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Open `.env` and add the password for the `info@ssbgroups.in` mailbox:

   ```ini
   SMTP_PASS=your-hostinger-mailbox-password
   ```

   The other Hostinger values are already filled in:

   ```ini
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=info@ssbgroups.in
   MAIL_TO=info@ssbgroups.in
   MAIL_FROM=info@ssbgroups.in
   MAIL_FROM_NAME=SSB Group Website
   ```

3. Send a test email:

   ```powershell
   npm run test:email
   ```

4. Run the full site with the serverless functions:

   ```powershell
   npx vercel dev
   ```

   `vercel dev` may ask you to log in and link the project the first time.

## Vercel production setup

`.env` is only for local development and is excluded from Git. Production
values must be added in Vercel:

1. Open the project in Vercel.
2. Go to **Settings → Environment Variables**.
3. Add these keys for **Production** (and **Preview** if desired):

   | Key | Value |
   | --- | --- |
   | `SMTP_HOST` | `smtp.hostinger.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_SECURE` | `true` |
   | `SMTP_USER` | `info@ssbgroups.in` |
   | `SMTP_PASS` | The Hostinger mailbox password |
   | `MAIL_TO` | `info@ssbgroups.in` |
   | `MAIL_FROM` | `info@ssbgroups.in` |
   | `MAIL_FROM_NAME` | `SSB Group Website` |

4. Redeploy the project (or push a new commit) so the variables take effect.

> At minimum, set `SMTP_PASS`. `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
> `SMTP_USER`, `MAIL_TO` and `MAIL_FROM` already default to the Hostinger
> settings in `api/_lib/mailer.js`.

> Never commit the mailbox password. If it has already been shared, change it
> in Hostinger hPanel and update the Vercel variable.

## Troubleshooting

- **`SMTP_NOT_CONFIGURED`** — `SMTP_PASS` is empty in `.env` or missing in Vercel.
- **`EAUTH`** — Hostinger rejected the login. Confirm the mailbox password and
  that `SMTP_USER` is the full address, `info@ssbgroups.in`.
- **`ETIMEDOUT` / `ESOCKET`** — outbound port 465 is blocked. Try
  `SMTP_PORT=587` and `SMTP_SECURE=false` (STARTTLS) locally and in Vercel.
- **Form shows a generic error locally** — plain `python -m http.server` does not
  run Vercel functions. Use `npx vercel dev` for local form testing.

## Files

- `api/contact.js` — contact form endpoint.
- `api/subscribe.js` — newsletter endpoint.
- `api/_lib/mailer.js` — shared SMTP transport, validation and email layout.
- `js/forms.js` — browser-side form submission, loading and status messages.
- `scripts/test-email.js` — sends a test email using the `.env` settings.
- `.env.example` — template for local environment values.
