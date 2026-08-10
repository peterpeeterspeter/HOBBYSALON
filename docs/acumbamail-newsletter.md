# Acumbamail newsletter sync

Hobbysalon is the consent source of truth (`subscribers`, `newsletter_opt_in_events`).
Acumbamail is the downstream ESP for marketing campaigns. Resend stays on transactional
mail (confirmation links, download delivery, commerce notifications).

## Architecture

1. Visitor submits `NewsletterSignupForm` (footer or lead magnet).
2. Platform stores consent in Supabase.
3. Lead magnets: Resend confirmation → `/nieuwsbrief/bevestigen` → Acumbamail sync + download mail.
4. Generic footer signup: immediate Acumbamail sync after `subscribers` upsert.

## Required Vercel env (storefront)

| Variable | Status (2026-08-10) | Notes |
|----------|---------------------|-------|
| `ACUMBAMAIL_WEBHOOK_URL` | Set (Production, Development, Preview `deploy-main`) | Incoming webhook for add-subscriber |
| `RESEND_API_KEY` | Set | Lead-magnet + download mail |
| `RESEND_FROM_EMAIL` | Set | Verified sender |
| `NEXT_PUBLIC_SITE_URL` | Set | Production site origin |
| `NEWSLETTER_CONFIRMATION_SECRET` | Set (Production, Development, Preview `deploy-main`) | HMAC secret for lead-magnet confirm tokens |

Create / rotate the webhook in Acumbamail: [Incoming webhooks](https://en.soporte.acumbamail.com/article/357-incoming-webhooks).  
API overview: [Acumbamail API](https://acumbamail.com/en/apidoc/).

After changing env vars, **redeploy** the storefront so production picks them up.

Hobbysalon POSTs JSON (`Content-Type: application/json`). Map these paths in the webhook UI:

| JSON path | Acumbamail field | Notes |
|-----------|------------------|-------|
| `email` | email (required) | Lowercased |
| `voornaam` | list merge field | Optional |
| `plaats` | list merge field | Optional |
| `taal` | list merge field | Always `nl` |
| `country` | list merge field | Always `BE` (default; refine later if needed) |
| `url` | list merge field | Source path (`/`, `/gratis-haakpatronen`, …) |
| `added` | list merge field | ISO timestamp of consent/confirm |
| `double_optin` | operation flag | Always `0` (consent already collected on Hobbysalon) |
| `welcome_email` | operation flag | Always `0` (avoid duplicate welcome vs lead-magnet delivery) |
| `update_subscriber` | operation flag | Always `1` |
| `optin` | list merge field if present | Always `1` |

## Smoke test

1. Confirm `ACUMBAMAIL_WEBHOOK_URL` is non-empty on Production (verified 2026-08-10).
2. Direct webhook POST returned HTTP 200 with a subscriber id (smoke contact created).
3. After storefront redeploy: footer signup → `subscribers.acumbamail_synced_at` set → contact in Acumbamail.
4. Lead-magnet path needs `NEWSLETTER_CONFIRMATION_SECRET` (now set) + redeploy.
5. Runtime logs: `[acumbamail] sync ok` (no email addresses logged).

## Out of scope

- Replacing Resend transactional mail
- Acumbamail SMS / landing pages / in-app campaign UI
- Bulk import of the legacy ~44k list (separate one-off once fields are stable)
- Unsubscribe webhook back into `subscribers.status` (later phase)
