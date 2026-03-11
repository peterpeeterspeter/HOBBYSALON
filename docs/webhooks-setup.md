# Webhooks Setup Guide

This guide explains how to configure Stripe webhooks for the Hobbysalon/Mercur backend.

---

## Webhook Endpoints

Your backend exposes two webhook endpoints:

| Endpoint | Purpose | Env variable for signing secret |
|----------|---------|---------------------------------|
| `POST /hooks/payment/stripe-connect` | Payment events (succeeded, failed, etc.) | `STRIPE_PAYMENT_WEBHOOK_SECRET` or `STRIPE_WEBHOOK_SECRET` |
| `POST /hooks/payouts` | Stripe Connect account events (account.updated) | `STRIPE_CONNECTED_ACCOUNTS_WEBHOOK_SECRET` |

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
stripe listen --forward-to localhost:9000/hooks/payment/stripe-connect
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

## Production: Add endpoints in Stripe Dashboard

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. **Endpoint URL**: `https://your-backend-domain.com/hooks/payment/stripe-connect`
4. **Events to send**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.amount_capturable_updated`
5. Click **Add endpoint**
6. Reveal the **Signing secret** (`whsec_...`) and add it to your production env as `STRIPE_WEBHOOK_SECRET`

Repeat for payouts:

1. **Endpoint URL**: `https://your-backend-domain.com/hooks/payouts`
2. **Events**: `account.updated` (for Connect accounts)

---

## Events handled

### Payment webhook (`/hooks/payment/stripe-connect`)

- `payment_intent.succeeded` – payment captured
- `payment_intent.payment_failed` – payment failed
- `payment_intent.amount_capturable_updated` – payment authorized

### Payout webhook (`/hooks/payouts`)

- `account.updated` – Stripe Connect account status changes; used to mark payout accounts as active after onboarding

---

## Order confirmation email (separate)

The success page says "Je ontvangt binnenkort een bevestiging per e-mail", but order confirmation emails are **not** sent by webhooks. They are sent by the **Medusa notification module** (Resend) when order events fire.

To enable order confirmation emails:

1. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env`
2. Ensure a notification template/subscriber exists for order placed events
3. Check the Resend/notification module docs for template setup

Webhooks are for Stripe → backend communication (payment status, Connect account status), not for sending emails.
