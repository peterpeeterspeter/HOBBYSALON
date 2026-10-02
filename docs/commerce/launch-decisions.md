# Commerce launch decisions (D1–D6)

Recorded for the physical-product ecommerce launch. Recommendations from the launch plan are accepted here unless noted. These decisions unblock EC03–EC15 work.

**Baseline revision at recording:** `ee025a2ee` (recheck against audit revision `6bb0d5ca` when starting a ticket).

| ID | Decision | Status | Choice |
|----|----------|--------|--------|
| D1 | Cart scope | **Accepted** | One seller per cart. Enforced on every server add/bundle path. Explain before adding a second seller; never silently drop items. |
| D2 | Destinations | **Accepted** | Belgium (`be`) and Netherlands (`nl`) only, and only where that seller has valid shipping/tax. Do not hardcode NL for all checkouts. |
| D3 | Buyer identity | **Accepted (phase 1)** | Authenticated buyers for order list/detail. Guest checkout may complete payment; post-purchase order access for guests is a follow-up (expiring access session). Email or order ID alone never authorizes the API. |
| D4 | Payment methods | **Accepted (phase 1)** | Card only on the mounted Stripe Connect product path. Bancontact / iDEAL only after proven on the same charge/capture flow. |
| D5 | Financial policy | **Accepted** | Commission per `docs/billing-commission-matrix.md` (supply 10%, handmade listing-fee not sale commission, workshop_kit 10%/6% creator). Customer refund and seller transfer reversal are separate amounts. Never reverse more than remaining seller transfer. Shipping refundable only when ops explicitly refunds it. Transfers wait until commission lines exist (including explicit zero). |
| D6 | Operations | **Pending names** | Launch merchants, support owner, tax/invoice owner, and release approver must be named before EC16/EC18. Checklist: [`ops-go-live.md`](./ops-go-live.md). Shipping promises and return process copy follow certified merchants. |

## Non-goals

Workshops/events, listing-fee payments, creator subscriptions, coupons, loyalty, second vendor UI, inquiry-only handmade/destash checkout.
