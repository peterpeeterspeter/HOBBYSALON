# Hobbysalon — Agent Rules (Cursor)

Rules and context for AI-assisted development.

---

## Project Context

- **Hobbysalon** is a connected creative hobby platform (handmade + supplies + workshops + events + articles)
- **Audience**: predominantly female 55+ — senior-friendly UX is required
- **Stack**: Next.js, TypeScript, Postgres/Supabase, Mercur/Medusa, Stripe

---

## Core Principles

1. **Entity graph**: Everything (domains, creators, products, workshops, events, articles) can link to everything via `entity_links`.
2. **Platform-first**: Postgres holds the platform graph; Medusa holds commerce. Products bridge via `medusa_product_id`.
3. **Senior-friendly UI**: Large typography, clear buttons, minimal clutter, max 3 clicks to checkout.

---

## Key Paths

- Platform schema: `docs/schema.md`, `docs/SQL.md`
- Architecture: `docs/architecture.md`
- PRD: `docs/PRD.md`
- Storefront: `apps/storefront/`
- Backend: `apps/backend/`
- Product linking: `apps/storefront/scripts/link-medusa-products.ts`

---

## Conventions

- Use Dutch for user-facing copy in the storefront
- Keep data access in `lib/platform/queries/*` and composition in `lib/services/*`
- Prefer server components for public pages; keep client components interaction-focused
- Environment variables for secrets; never hardcode keys

---

## Product Types (Platform)

Valid `product_type` values: `supply`, `handmade`, `event_listing`, `event_ticket`, `workshop_ticket`, `workshop_kit`.
