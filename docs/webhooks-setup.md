# Webhooks Setup Guide

This guide explains how to configure Stripe webhooks for the Hobbysalon/Mercur backend.

---

## Webhook Endpoints

Your backend exposes two webhook endpoints:

| Endpoint | Purpose | Env variable for signing secret |
|----------|---------|---------------------------------|
| `POST /hooks/payment/card_stripe-connect` | Payment events (succeeded, failed, etc.) | `STRIPE_PAYMENT_WEBHOOK_SECRET` or `STRIPE_WEBHOOK_SECRET` |
| `POST /hooks/payouts` | Stripe Connect account events (`account.updated` and Accounts v2 recipient capability updates) | `STRIPE_CONNECTED_ACCOUNTS_WEBHOOK_SECRET` |

Base URL (local): `http://localhost:9000`

---

## Local Development: Stripe CLI

Stripe can't reach `localhost` directly. Use the **Stripe CLI** to forward webhooks to your machine:

### 1. Install Stripe CLI

```bash
# macOS (Homebrew)
brew install stripe/stripe-cli/stripe

# Or download from https://stripe.com/docs/stripe-cli
```

### 2. Login

```bash
stripe login
```

### 3. Forward payment webhooks to your backend

```bash
stripe listen --forward-to localhost:9000/hooks/payment/card_stripe-connect
```

The CLI will output a webhook signing secret like `whsec_...`. Add it to `apps/backend/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

(Or `STRIPE_PAYMENT_WEBHOOK_SECRET` – both are used by medusa-config.)

### 4. Forward payout/account webhooks (for seller Connect onboarding)

```bash
# In a second terminal
stripe listen --forward-to localhost:9000/hooks/payouts --events account.updated
```

Use the secret from this listener for Connect account webhooks:

```env
STRIPE_CONNECTED_ACCOUNTS_WEBHOOK_SECRET=whsec_xxxxx
```

### 5. Restart backend after adding secrets

```bash
cd apps/backend && yarn dev
```

---

## Production (live Hobbysalon)

Live account: `acct_1T9liXKYtYRhUUb3` (Hobbysalon, BE/EUR). Platform charges and payouts are enabled.

| Endpoint | Mode | Events | Env |
|----------|------|--------|-----|
| `https://api.hobbysalon.be/hooks/payment/card_stripe-connect` | Live (platform) | `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.amount_capturable_updated`, `payment_intent.canceled` | `STRIPE_PAYMENT_WEBHOOK_SECRET` / `STRIPE_WEBHOOK_SECRET` |
| `https://api.hobbysalon.be/hooks/payouts` | Live (**Connect** endpoint) | `account.updated` | `STRIPE_CONNECTED_ACCOUNTS_WEBHOOK_SECRET` |
| `https://www.hobbysalon.be/api/webhooks/stripe-listing` | Live (platform) | `checkout.session.completed` | `STRIPE_LISTING_WEBHOOK_SECRET` (Vercel storefront) |

Production VPS and Vercel use **live** API keys (`sk_live` / `pk_live`). Local `apps/backend/.env` and storefront `.env.local` stay on **test** keys for development.

### Re-creating endpoints (if needed)

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks) (live mode)
2. Add payment endpoint → `https://api.hobbysalon.be/hooks/payment/card_stripe-connect` with the payment_intent events above
   (Medusa resolves the path segment as provider id `pp_<path>`; the registered provider is `pp_card_stripe-connect`, not `pp_stripe-connect`)
3. Add Connect endpoint → `https://api.hobbysalon.be/hooks/payouts` with **Listen to events on Connected accounts** and `account.updated`
4. Put each signing secret (`whsec_...`) in the matching production env var and recreate/redeploy the backend

---

## Events handled

### Payment webhook (`/hooks/payment/card_stripe-connect`)

- `payment_intent.succeeded` – payment captured
- `payment_intent.payment_failed` – payment failed
- `payment_intent.amount_capturable_updated` – payment authorized

### Payout webhook (`/hooks/payouts`)

- `account.updated` – connected account status changes after Express onboarding
- `v2.core.account[configuration.recipient].capability_status_updated` – Accounts v2 recipient transfer capability changes

Seller Connect onboarding creates Accounts v2 **recipient** Express accounts (`POST /v2/core/accounts` + `/v2/core/account_links`) via the payout provider. Multi-seller carts still settle with platform PaymentIntents + Transfers; single-destination Checkout can use `createMarketplaceDestinationCheckoutSession`.

---

## Order confirmation email (separate)

The success page says "Je ontvangt binnenkort een bevestiging per e-mail", but order confirmation emails are **not** sent by webhooks. They are sent by the **Medusa notification module** (Resend) when order events fire.

To enable order confirmation emails:

1. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env`
2. Ensure a notification template/subscriber exists for order placed events
3. Check the Resend/notification module docs for template setup

Webhooks are for Stripe → backend communication (payment status, Connect account status), not for sending emails.
