# Hobbysalon Billing and Commission Matrix

## Purpose

This document defines the MVP commission rules for Hobbysalon. Stripe is the payment rail; Mercur/Medusa commission logic owns fee calculation. Workshop subscriptions are **not** part of MVP and are treated as a future custom extension.

---

## Commission Matrix (MVP)

| Product type     | Fee type   | Default fee | Notes                               |
|------------------|------------|-------------|-------------------------------------|
| `supply`         | percentage | 10%         | Marketplace materials / supplies    |
| `handmade`       | percentage | 6%          | Handmade marketplace (transitioning to listing fee, see `docs/listing-first-integration-plan.md`) |
| `destash`        | n/a        | none        | Maker listing for leftover/secondhand materials; platform-only, listing fee, never falls under the `supply` commission rule |
| `event_listing`  | flat       | TBD         | Event listing promotion/placement  |
| `event_ticket`   | flat       | TBD         | Event tickets                      |
| `workshop_ticket`| flat       | TBD         | Workshop bookings                  |
| `workshop_kit`   | commerce   | 10% (6% creator sellers) | Kit products; seller-type override at order time        |

### Notes

- **supply, handmade**: Percentage commission on sale amount (line item total, not shipping).
- **workshop_kit**: Default 10% product-type rule; creator sellers resolved to 6% in commission workflow.
- Commission base excludes shipping lines; payment/checkout fees are separate from commission.
- **event_listing, event_ticket, workshop_ticket**: Flat fee per item/booking. MVP uses placeholder 1 EUR (100 cents) until business defines final values. Update seed in `apps/backend/src/scripts/seed/seed-functions.ts` when amounts are decided.
- **workshop_kit**: No platform commission; treated as standard commerce (seller revenue).

---

## Architecture Rules

- **Stripe**: payment rail only. Stripe does not own fee logic.
- **Mercur/Medusa**: commission rules and calculation. Rules use `reference: "product_type"` and `reference_id` = Medusa product type ID (`ptype_xxx`).
- **Hobbysalon**: no dependency on recurring billing for core marketplace flows.
- **Workshop subscriptions**: not in MVP; do not design around them now.

---

## Implementation

- Commission rules are seeded for each product type.
- Medusa product types must exist: supply, handmade, event_listing, event_ticket, workshop_ticket, workshop_kit.
- Order line items carry `product_type_id` from `variant.product.type?.id`; commission selection uses that to match product-type rules before falling back to site default.

---

## Technical Blockers

None for MVP. The commission module supports both percentage and flat rates. Medusa product types are created at seed; commission rules are created per product type. Products must have `type_id` set (via Medusa product type) for product-type-specific rules to apply; otherwise the site default rule is used.
