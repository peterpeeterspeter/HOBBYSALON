# What's Next: Payments

Status and next steps for the three remaining payment items.

---

## 1. Stripe Keys / Webhooks

### Status: ✅ Production live + local test

| Item | Status | Notes |
|------|--------|-------|
| Live platform | ✅ Done | Hobbysalon `acct_1T9liXKYtYRhUUb3` — charges/payouts enabled, BE/EUR, card + Bancontact on |
| Live API keys | ✅ Done | VPS `STRIPE_SECRET_API_KEY` + Vercel `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / listing secret key are live |
| Live payment webhook | ✅ Done | `https://api.hobbysalon.be/hooks/payment/card_stripe-connect` (`pp_card_stripe-connect`) |
| Live Connect webhook | ✅ Done | `https://api.hobbysalon.be/hooks/payouts` (`account.updated`, Connect endpoint) |
| Live listing webhook | ✅ Done | `https://www.hobbysalon.be/api/webhooks/stripe-listing` |
| Local/dev keys | ✅ Test | Keep `apps/backend/.env` + storefront `.env.local` on test keys; use Stripe CLI for local webhooks |

### "Unhandled payment Element loaderror" / "PaymentIntent is in a terminal state"

De PaymentElement kan niet laden. Mogelijke oorzaken:

- **Terminal state**: Een eerdere betalingspoging heeft de PaymentIntent afgesloten. De backend route `/store/carts/:id/payment-client-secret` vernieuwt automatisch: bij een terminale status wordt de sessie verwijderd en een nieuwe aangemaakt.
- **Stripe-keys**: `STRIPE_SECRET_API_KEY` (backend) en `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (storefront) moeten van hetzelfde Stripe-account komen
- **client_secret**: Moet een PaymentIntent secret zijn; de backend maakt deze aan via `initiatePaymentSession`
- **Medusa backend**: Moet draaien op `MEDUSA_BACKEND_URL`

Bij "terminal state": klik op "Opnieuw laden" in het betaalformulier.

### "Er is een verwerkingsfout opgetreden"

Dit is Stripe’s generieke foutmelding. Mogelijke oorzaken:

- **Testbetaling**: Gebruik de Stripe testkaart `4242 4242 4242 4242` met een geldige vervaldatum en CVV
- **Kaart geweigerd**: Sommige testkaarten (bv. `4000000000000002`) worden bewust geweigerd
- **Stripe-keys**: Zorg dat `STRIPE_SECRET_API_KEY` (backend) en `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (storefront) van hetzelfde Stripe-account komen
- **Medusa backend**: Moet draaien op `MEDUSA_BACKEND_URL`; de Store API maakt de PaymentIntent aan

### Local Connect webhook (dev only)

When testing seller payouts against sandbox/test keys:

1. Run: `stripe listen --forward-to localhost:9000/hooks/payouts --events account.updated`
2. Add to `.env`: `STRIPE_CONNECTED_ACCOUNTS_WEBHOOK_SECRET=whsec_xxx` (from CLI output)

Sellers complete Express onboarding in the verkopersportaal (`/stripe-connect`). Production marks payout accounts ACTIVE after Stripe sends `account.updated` to the live Connect webhook.

---

## 2. Order Confirmation Email

### Status: ✅ Implementation exists

The buyer order confirmation email **is implemented** in `packages/modules/resend`:

- **Subscriber**: `notification-buyer-new-order.ts` listens for `OrderWorkflowEvents.PLACED`
- **Template**: `BuyerNewOrderEmailTemplate`
- **Flow**: Order placed → Resend sends email to `order.email`

### What you need

1. **Verify `RESEND_FROM_EMAIL`**  
   Resend requires a verified sender. `noreply@example.com` will fail.

   **Fix**: In [Resend Dashboard](https://resend.com/domains):
   - Add and verify your domain (e.g. `hobbysalon.be`)
   - Or use Resend’s test domain, e.g. `onboarding@resend.dev` (if allowed for your plan)

   Then in `.env`:
   ```
   RESEND_FROM_EMAIL=Hobbysalon <noreply@yourverifieddomain.com>
   ```

2. **Check order email**  
   The cart must have `email` (from the checkout address form). The storefront already collects it.

3. **Restart backend** after changing `.env`.

### Quick test

Place a test order with your own email. If Resend is configured correctly, you should receive the confirmation email. Check backend logs for Resend errors if not.

---

## 3. Admin Refund UI

### Status: Backend ready, UI to add

**Backend**: `refundSplitOrderPaymentWorkflow` exists and:

- Takes `{ id: split_order_payment_id, amount }`
- Updates `split_order_payment.refunded_amount`
- Calls Stripe refund via `refundPaymentsStep`

**API**: No dedicated refund route found; the workflow is invoked from cancel/return flows. You’ll need an admin API route that calls `refundSplitOrderPaymentWorkflow`.

**Admin panel**: The project uses a separate [Mercur admin panel](https://github.com/mercurjs/admin-panel). Refund UI would go there.

### Steps to add refund support

1. **Admin API route**  
   Add something like `POST /admin/orders/:id/refund` that:
   - Loads the order and its `split_order_payment`
   - Validates refund amount
   - Calls `refundSplitOrderPaymentWorkflow.run()`

2. **Admin panel UI**  
   In the admin order detail view:
   - Show refunded amount and status
   - Add “Refund” with amount input
   - Call the new admin refund API

---

## Summary

| Item | Effort | Action |
|------|--------|--------|
| Stripe + Connect (live) | Done | Live keys, payment + Connect + listing webhooks on production |
| Order confirmation email | Low | Fix `RESEND_FROM_EMAIL` (verified domain in Resend) |
| Admin refund UI | Medium | Add admin API + UI in Mercur admin panel |
