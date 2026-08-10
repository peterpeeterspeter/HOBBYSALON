# Hobbysalon Documentation

Overview of documentation files in this repository.

---

## Core Docs

| File | Description |
|------|-------------|
| [PRD.md](./PRD.md) | Product requirements document — vision, scope, user types, UX |
| [schema.md](./schema.md) | Data model — domains, creators, products, workshops, events, articles |
| [architecture.md](./architecture.md) | Technical architecture — layers, integrations, flows |
| [phase-5-sprintboard.md](./phase-5-sprintboard.md) | Sprint planning for Phase 5 (P0/P1/P2) |

---

## Commerce & Payments

| File | Description |
|------|-------------|
| [billing-commission-matrix.md](./billing-commission-matrix.md) | Commission rules per product type |
| [webhooks-setup.md](./webhooks-setup.md) | Stripe webhook configuration |
| [whats-next-payments.md](./whats-next-payments.md) | Payment status, troubleshooting, order emails |

---

## Operations

| File | Description |
|------|-------------|
| [troubleshoot-add-product.md](./troubleshoot-add-product.md) | Add-to-cart and product linking debugging |
| [SQL.md](./SQL.md) | Platform schema DDL, migrations |
| [acumbamail-newsletter.md](./acumbamail-newsletter.md) | Acumbamail ESP sync, webhook env, field mapping |

---

## AI / Cursor

| File | Description |
|------|-------------|
| [agents.md](./agents.md) | Cursor rules and agent context |

---

## Quick Links

- **Platform DB**: Postgres/Supabase — domains, creators, workshops, events, articles, entity_links
- **Commerce**: Mercur/Medusa — products, carts, orders, checkout
- **Storefront**: `apps/storefront` — Next.js public site
- **Backend**: `apps/backend` — Medusa + custom routes

---

## Analytics Event Dictionary (Storefront)

| Event | Trigger | Required payload fields |
|------|---------|-------------------------|
| `project_view` | Project detail page mount | `project_id`, `project_slug`, `difficulty_level` |
| `home_recommendations_viewed` | Home recommendations section mount | `recommendation_source`, `item_count` |
| `bundle_add` | Project bundle add-to-cart action | `bundle_id`, `bundle_label`, `item_count` |
| `add_to_cart` | Add-to-cart success | `variant_id`, `quantity` |
| `workshop_booking_request_submitted` | Booking request success | `workshop_id`, `creator_id` |
| `newsletter_signup` | Newsletter form success | `signup_source` |
| `checkout_started` | Checkout page mount | `currency_code`, `total_amount`, `item_count`, `bundle_id`, `bundle_count`, `bundle_value` |
| `checkout_completed` | Checkout success page mount | `order_id`, `bundle_id`, `bundle_count`, `bundle_value` |

All tracked events include shared metadata from `trackEvent`:

- `timestamp`
- `source` (`storefront`)
- `session_id`
- `visitor_id`
- `actor_id` (prefers `user_id`, else `visitor_id`)
- `path`
- `funnel_stage`
- `schema_valid` + `required_fields_missing`

### Analytics QA Checklist (Staging)

- Open `/dashboard/analytics` while logged in and verify funnel counters move after user actions.
- Run discovery step: open at least one project page and verify `project_view` is schema-valid.
- Run intent step: use bundle add and regular add-to-cart, verify `bundle_add` and `add_to_cart`.
- Run checkout step: open checkout page and verify `checkout_started` with currency + totals.
- Run purchase step: place test order and verify `checkout_completed` with `order_id`.
- Confirm no schema-invalid rows for required funnel events in the latest events table.
