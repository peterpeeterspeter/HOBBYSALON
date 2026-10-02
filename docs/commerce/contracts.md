# Commerce contracts

Executable identity and money boundaries for the physical-product launch. Matches existing Medusa/Mercur and storefront types.

## Identities

| Concept | Source of truth | Notes |
|---------|-----------------|-------|
| Platform product | Supabase `products.id` | Discovery/SEO. Bridge via `products.medusa_product_id`. |
| Medusa product | Medusa `product.id` | Stock, variants, sales channel. |
| Variant | Medusa `product_variant.id` | Cart line and price authority. |
| Cart | Medusa `cart.id` | Storefront cookie `hs_cart` / `CART_COOKIE_NAME`. |
| Buyer (customer) | Medusa `customer.id` = `auth_context.actor_id` | Store order APIs must filter on this. |
| Order set | Mercur `order_set.id` | Multi-seller checkout container. Buyer-facing receipt id. |
| Seller order | Medusa `order.id` linked via seller-order link | Fulfilment and payout unit. |
| Split order payment | Mercur `split_order_payment` | Captured/refunded amounts per seller order. |
| Commission line | Mercur `commission_line`, keyed by `item_line_id` | One logical line per order item; replay must not duplicate. |
| Payout / reversal | Mercur payout module + Stripe Connect transfer | Reversal ≤ remaining transferred amount. |

## Money units

- Medusa Store API amounts: **major units** (e.g. `9.99`). Convert with `medusaAmountToCents` at the UI boundary.
- Platform / commission / payout internals: treat provider and module amounts as documented by each module; never infer cents from a variable name alone.
- Display and cart must show the **selected variant** amount, not a stale first-variant price.

## Response contracts (summary)

| Situation | Expected behaviour |
|-----------|-------------------|
| Owned order retrieve | 200 with buyer-safe order set |
| Foreign order id | 404 (fail closed; do not leak existence) |
| Missing auth on order-set | 401 |
| Payment Intent `succeeded` | Return `payment_succeeded: true`; do not recreate session |
| Payment Intent unknown / retrieve error with existing session | Return pending; **do not** delete session |
| Payment Intent `canceled` | May recreate session |
| Refund vs reversal | Customer refund amount and seller reversal amount are separate; reversal capped at remaining transfer |
| Commission missing | Payout not eligible (`commission_not_ready`); do not treat as zero fee |
| Explicit zero commission | Transfer may proceed with payout = captured − refunded |
| Second seller add to cart | Reject with clear Dutch message (D1) |
| Unsupported country | Reject before payment (D2: `be` / `nl` only when seller ships there) |

## Product eligibility

| State | Condition |
|-------|-----------|
| Purchasable | `product_type = supply` (or legacy Medusa-linked) with price, stock, channel |
| Inquiry-only | `handmade` / `destash` without checkout |
| Unavailable | Draft, missing link, no price, sold out |
| Service unavailable | Backend/Medusa outage — distinct from empty cart |

## Fixtures (sandbox)

Synthetic only: two buyers, two sellers, differently priced variants, last-item stock, missing-shipping seller, draft product, disabled Connect account, partial-refund order.

Go-live ops (seller certify, sandbox reconciliation, server payment gate): [`ops-go-live.md`](./ops-go-live.md).
