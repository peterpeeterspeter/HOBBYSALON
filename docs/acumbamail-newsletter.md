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
| `ACUMBAMAIL_AUTH_TOKEN` | Required | Auth token for `POST https://acumbamail.com/api/1/addSubscriber/` |
| `ACUMBAMAIL_LIST_ID` | Optional | Defaults to `836565` (Hobbysalon Subscribers) |
| `RESEND_API_KEY` | Set | Lead-magnet + download mail |
| `RESEND_FROM_EMAIL` | Set | Verified sender |
| `NEXT_PUBLIC_SITE_URL` | Set | Production site origin |
| `NEWSLETTER_CONFIRMATION_SECRET` | Set (Production, Development, Preview `deploy-main`) | HMAC secret for lead-magnet confirm tokens |

The form calls [addSubscriber](https://acumbamail.com/apidoc/) as form data. Merge fields match the Hobbysalon Subscribers list: `email`, `Voornaam`, `Plaats`, `Taal` (`nl`), `country` (`BE`), `optin`, `url`, `added`. Consent is already collected on Hobbysalon, so `double_optin` and `welcome_email` stay `0` and `update_subscriber` is `1`.

After changing env vars, **redeploy** the storefront so production picks them up.

## Smoke test

1. Confirm `ACUMBAMAIL_AUTH_TOKEN` is set on Production and `ACUMBAMAIL_LIST_ID` is `836565` or unset.
2. After storefront redeploy: footer signup → `subscribers.acumbamail_synced_at` set → contact on Hobbysalon Subscribers.
3. Lead-magnet path needs `NEWSLETTER_CONFIRMATION_SECRET` (now set) + redeploy.
4. Runtime logs: `[acumbamail] sync ok` (no email addresses logged).

## Out of scope

- Replacing Resend transactional mail
- Acumbamail SMS / landing pages / in-app campaign UI
- Bulk import of the legacy ~44k list (separate one-off once fields are stable)
- Unsubscribe webhook back into `subscribers.status` (later phase)
