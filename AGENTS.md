# Hobbysalon — Agent Context

**Hobbysalon** is a connected creative hobby platform built on **Mercur 1.5.4** / **Medusa 2.11.3**, extended with a Supabase platform layer. This is not a stock Mercur marketplace — commerce is one layer in a larger graph.

## Architecture

```text
Next.js storefront (apps/storefront)
  → Supabase platform DB (creators, workshops, events, articles, entity_links)
  → Mercur/Medusa commerce (apps/backend + packages/modules/*)
  → External services (Stripe, Resend, optional Algolia)
```

| Layer | Location | Owns |
|-------|----------|------|
| **Platform** | Supabase / `lib/platform/*` | Creators, domains, workshops, events, articles, favorites, `entity_links` |
| **Commerce** | `apps/backend`, `packages/modules/*` | Carts, orders, checkout, sellers, commissions, payouts |
| **Storefront** | `apps/storefront` | Public site, creator dashboard, Dutch UX |
| **Vendor portal** | `apps/vendor-panel` | Seller commerce ops at `verkoper.hobbysalon.be` |

**Boundary:** Platform DB holds discovery and SEO; Medusa holds transactional truth. Products bridge via `products.medusa_product_id`.

## Mercur / Medusa (commerce)

- Backend: `apps/backend/` (Medusa, deployed on VPS at `api.hobbysalon.be`)
- Modules: `packages/modules/b2c-core`, `commission`, `payment-stripe-connect`, `reviews`, `requests`, `resend`, `algolia`
- Do **not** treat Mercur as the full application model — it is the commerce engine

### Documentation

- **Mercur MCP** — `.cursor/mcp.json`; use `SearchMercurJsDocumentation` for live docs
- **llms.txt** — https://docs.mercurjs.com/llms.txt
- **MCP setup** — https://docs.mercurjs.com/ai-development/mcp

**Version caveat:** MCP docs describe **Mercur 2.x** (blocks, CLI, `packages/api`). This repo uses **1.5.4** layout (`apps/backend`, `packages/modules/*`). Adapt patterns; do not copy 2.x paths verbatim.

## Hobbysalon platform rules

1. **Entity graph** — domains, creators, products, workshops, events, articles link via `entity_links`
2. **Platform-first** — complex page data in `lib/platform/queries/*` and `lib/services/*`, not inline in pages
3. **Senior-friendly UX** — audience is predominantly 55+; large type, clear CTAs, max 3 clicks to checkout
4. **Dutch copy** — user-facing storefront text in Dutch
5. **Secrets** — environment variables only; never hardcode keys

## Key paths

| Topic | Path |
|-------|------|
| Architecture | `docs/architecture.md` |
| Platform schema | `docs/schema.md`, `docs/SQL.md` |
| PRD | `docs/PRD.md` |
| Payments / Stripe | `docs/whats-next-payments.md`, `docs/webhooks-setup.md` |
| Storefront | `apps/storefront/` |
| Creator dashboard | `apps/storefront/src/app/(dashboard)/` |
| Product linking | `apps/storefront/scripts/link-medusa-products.ts` |
| VPS deploy | `deploy/vps/` |

## Product types (platform)

`supply`, `handmade`, `destash`, `event_listing`, `event_ticket`, `workshop_ticket`, `workshop_kit`

## When to use which docs

| Question | Source |
|----------|--------|
| Creators, workshops, Supabase, entity_links | Local `docs/` |
| Stripe Connect, payouts, vendor APIs, workflows | Mercur MCP |
| Medusa module patterns | Mercur MCP (adapt to 1.5.4 paths) |
| Mercur 2.x blocks / CLI migration | MCP + https://docs.mercurjs.com/migrations/overview |

## Two dashboards

Hobbysalon runs **two seller-facing surfaces**:

| Surface | URL | Owns |
|---------|-----|------|
| **Creator dashboard** | `www.hobbysalon.be/dashboard` | Profile, workshops, events, materials import, platform product CRUD |
| **Verkopersportaal** | `verkoper.hobbysalon.be` | Shipping, inventory, promotions, returns, Stripe Connect, team members |

Users authenticate with **Supabase** on the storefront. The vendor panel receives a Medusa seller JWT via `POST /store/platform/seller-auth/exchange` and the `/dashboard/verkoper` handoff page.

Do not replace the creator dashboard with the vendor panel. Link merchants and creator-sellers to verkoper for commerce depth.

## Deployment

- **Storefront:** Vercel (`www.hobbysalon.be`)
- **Vendor portal:** Vercel (`verkoper.hobbysalon.be`) — see `deploy/verkoper-vercel.md`
- **API:** VPS Docker Compose (`api.hobbysalon.be`)
- Env: `MEDUSA_BACKEND_URL=https://api.hobbysalon.be`, `VENDOR_PANEL_URL=https://verkoper.hobbysalon.be`
