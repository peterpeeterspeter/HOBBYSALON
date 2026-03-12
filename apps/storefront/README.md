# Hobbysalon Storefront

Next.js storefront for the Hobbysalon creative hobby platform.

## Setup

1. For the Medusa backend, ensure CORS includes the storefront:
   - `STORE_CORS=http://localhost:3000,http://localhost:3002`
   - `AUTH_CORS` should include `http://localhost:3002` if using auth from the storefront.

2. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optionally `SUPABASE_SERVICE_ROLE_KEY` for the link script)
   - `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Stripe Connect uses the platform publishable key, e.g. `pk_test_...`; backend needs `STRIPE_SECRET_API_KEY`)
   - `PEXELS_API_KEY` (recommended for placeholders): get free key at https://www.pexels.com/api
  - `npx tsx scripts/seed-placeholder-images.ts` — downloads placeholder images from Pexels to public/landing/
- `LAOZHANG_API_KEY` (optional, for AI-generated images):
  - `npx tsx scripts/generate-landing-images.ts` — generates images via Nano Banana Pro (LaoZhang)
  - Design integration: EmptyState `image` prop, AspectImage `fallbackImage`, AIGeneratedImage component

3. Apply the platform schema in Supabase (see `docs/SQL.md` in the repo root).

4. Seed the platform database:
   ```bash
   psql $DATABASE_URL -f scripts/seed-platform.sql
   ```
   Or run the SQL in Supabase SQL Editor.

5. Seed Medusa (requires Postgres + Redis running; copy backend `.env.template` to `.env` with `DATABASE_URL`):
   ```bash
   cd ../backend && yarn seed
   ```
   This outputs the **Publishable api key** — copy it to storefront `.env.local` as `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`. The seed also creates shipping options for the seller — if checkout shows "no shipping options available", re-run `yarn seed` in the backend (it will add missing shipping options).

6. Start Medusa backend (in another terminal):
   ```bash
   cd apps/backend && yarn dev
   ```

7. Link platform products to Medusa (populates `medusa_product_id`):
   ```bash
   cd apps/storefront && npx tsx scripts/link-medusa-products.ts
   ```
   Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` for product updates (or configure RLS for anon).

## Development

```bash
yarn dev
```

Runs on port 3002.

## Build

```bash
yarn build
```

## End-to-End Verification

1. Start Medusa backend: `cd apps/backend && yarn dev`
2. Start storefront: `cd apps/storefront && yarn dev`
3. Visit:
   - http://localhost:3002/ — home with domain links
   - http://localhost:3002/crochet — domain hub (creators, products, workshops)
   - http://localhost:3002/creator/marie-haakt — creator profile
   - http://localhost:3002/product/handmade-crochet-scarf — product page with price and Add to cart
   - http://localhost:3002/workshop/amigurumi-beginners — workshop page
   - http://localhost:3002/cart — cart (after adding items)

Ensure Supabase and Medusa are seeded and linked before verification. Re-run `scripts/seed-platform.sql` to add workshops if they were added after initial setup.
