# Commerce go-live ops (EC16–EC18)

Operational gates only. Completing this checklist is **not** automatic authorization to charge live customers. Code gates below fail closed on incomplete checkout; live keys alone are not enough.

## EC16 — Certify named launch sellers

For each merchant allowed to sell physical `supply` stock at launch, confirm all of:

| Check | Where | Pass criteria |
|-------|--------|---------------|
| Named in D6 | `docs/commerce/launch-decisions.md` | Seller handle + owner contact recorded |
| Sales channel | Medusa admin / vendor | Product published on the storefront channel |
| Stock location | Vendor → inventory / locations | Default location exists and is linked to the seller |
| Shipping profile + options | Vendor → shipping | BE and/or NL geo zones match what they actually ship; options return in storefront checkout for those countries |
| Tax | Medusa tax regions | BE/NL tax region present for the region the cart uses |
| Stripe Connect | Verkopersportaal `/stripe-connect` | Account synced; transfers/payouts capability ready (not merely webhook “authorized”) |
| Sample SKU | Storefront product page | Purchasable (not inquiry); selected variant price + stock match Medusa |

Do not enable a merchant who only has a hidden Pay button or a draft Connect account.

## EC17 — Sandbox reconciliation before live charge

Run against **Stripe test** keys (local/staging), never against production charges as the first proof:

1. Place a one-seller BE cart → pay with test card `4242…` → order-set created → buyer email received.
2. Retrieve `/account/orders/{order_set_id}` as the buyer; foreign id returns 404.
3. Vendor creates shipment with real tracking number + optional URL → buyer shipped email fires.
4. Cancel or approve return → customer refund amount and seller reversal follow `allocateRefundAndReversal` (reversal ≤ remaining transfer).
5. Commission lines exist before payout; replay of `order_set.placed` does not duplicate `item_line_id`.
6. Stripe Dashboard: PaymentIntent, Connect transfer/reversal, and Resend delivery match the order-set id.

Only after a signed-off sandbox pass may production keys process a real launch SKU.

## EC18 — Server payment gate (not UI)

Checkout payment is allowed only when the **server** accepts it. Hiding the Pay UI is not a control.

Storefront `checkoutInitiatePayment` must refuse unless:

- Cart exists with line items
- Shipping address present with `country_code` in `{be,nl}`
- At least one shipping method selected on the cart
- `COMMERCE_PAYMENTS_ENABLED` is not explicitly disabled (`false` / `0` / `off`)

Backend payment-client-secret must not recreate sessions for unknown Stripe status (EC04).

### Env

| Variable | Role |
|----------|------|
| `COMMERCE_PAYMENTS_ENABLED` | Optional kill switch. Unset or `true` = allow when checkout prerequisites pass. `false`/`0`/`off` = server rejects payment start. |
| Stripe test vs live keys | Must match environment; never mix publishable + secret across modes |

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Release approver | _TBD (D6)_ | | |
| Support owner | _TBD (D6)_ | | |
| Tax / invoice owner | _TBD (D6)_ | | |

Record names in `launch-decisions.md` (D6) before flipping any production launch merchant.
