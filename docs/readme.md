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
| `add_to_cart` | Add-to-cart success | `variant_id`, `quantity` |
| `workshop_booking_request_submitted` | Booking request success | `workshop_id`, `creator_id` |
| `newsletter_signup` | Newsletter form success | `source` |
| `checkout_started` | Checkout page mount | `currency_code`, `total_amount`, `item_count` |
| `checkout_completed` | Checkout success page mount | `order_id` |

All tracked events include shared metadata from `trackEvent`:

- `timestamp`
- `source` (`storefront`)
- `session_id`
- `path`
