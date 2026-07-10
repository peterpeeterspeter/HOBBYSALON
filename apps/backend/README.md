# Mercur Backend

Marketplace backend for Mercur.

## Production deployment

The backend is a persistent Medusa server and should not be deployed as a
Vercel serverless project. The repository root contains a production Docker
Compose stack for an Ubuntu VPS:

- Medusa backend
- PostgreSQL
- Redis
- Caddy with automatic HTTPS

See [`deploy/vps/README.md`](../../deploy/vps/README.md) for installation and
DNS instructions. After the backend is healthy, set the storefront Vercel
environment variables:

```env
MEDUSA_BACKEND_URL=https://api.hobbysalon.be
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.hobbysalon.be
```

Then redeploy the storefront. The backend health check is available at
`/health`.

## Prerequisites

- Node.js v20+
- PostgreSQL
- Git CLI

## Scripts

- `yarn build` - Build the backend
- `yarn seed` - Seed the database
- `yarn start` - Start the backend
- `yarn dev` - Start the backend in development mode
- `yarn db:migrate` - Run migrations and module links
- `yarn test:integration:http` - Run API integration tests
- `yarn test:integration:modules` - Run module integration tests
- `yarn test:unit` - Run unit tests
- `yarn format` - Format the code
- `yarn lint` - Lint the code
- `yarn lint:fix` - Fix lint errors
- `yarn generate:oas` - Generate OpenAPI specification

## Platform Product Projection (P0)

Merchant `supply` products from Medusa are projected into the platform
Supabase `products` table through subscribers listening to:

- `algolia.products.changed`
- `algolia.products.deleted`

Required env vars:

- `PLATFORM_SUPABASE_URL` (fallback: `NEXT_PUBLIC_SUPABASE_URL`)
- `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` (fallback: `SUPABASE_SERVICE_ROLE_KEY`)
- `PLATFORM_SUPABASE_ANON_KEY` (fallback: `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — seller auth exchange

Seller auth bridge (vendor portal):

- `POST /store/platform/seller-auth/exchange` — Supabase bearer token → Medusa seller JWT
- One-time backfill: `yarn backfill:seller-auth` (links existing `user_seller_links` to seller auth identities)

Optional defaults:

- `PLATFORM_DEFAULT_DOMAIN_ID`
- `PLATFORM_DEFAULT_CATEGORY_ID`

Projection behavior:

- only `published` products from merchant sellers are projected
- only `supply` type is projected
- platform category/domain is resolved by Medusa product category handle first
- fallback to metadata (`platform_category_id`, `platform_domain_id`)
- fallback to env defaults
- products no longer matching projection criteria are archived on platform side

Backfill trigger (recommended on rollout):

- `POST /admin/platform/products/projection/sync`
- optional body: `{ "seller_id": "sel_...", "limit": 200 }`

Merchant readiness endpoint:

- `GET /admin/platform/materials/merchants`
- optional query: `q`, `limit`, `offset`
- returns onboarding KPI counts (mappings/imports/feeds/sync/published products)
- detail endpoint:
  - `GET /admin/platform/materials/merchants/:id`
  - returns latest mappings/imports/feed sources/sync jobs/product rows
- categories endpoint:
  - `GET /admin/platform/materials/categories`
- create mapping endpoint:
  - `POST /admin/platform/materials/merchants/:id/category-mappings`
  - body: `{ "source_category": "...", "domain_id": "pcat_...", "confidence": 0.8 }`
- feed source endpoints:
  - `GET /admin/platform/materials/merchants/:id/feed-sources`
  - `POST /admin/platform/materials/merchants/:id/feed-sources`
  - `PUT /admin/platform/materials/merchants/:id/feed-sources/:feed_id`
- import endpoints:
  - `POST /admin/platform/materials/merchants/:id/imports/dry-run`
  - body: `{ "csv_text": "...", "delimiter": ",", "currency_code": "eur" }`
  - `POST /admin/platform/materials/merchants/:id/imports`
  - body: `{ "csv_text": "...", "file_name": "merchant.csv" }`

If env vars are missing, projection is skipped safely.
