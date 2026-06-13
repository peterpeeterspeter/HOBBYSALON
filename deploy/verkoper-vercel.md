# Verkopersportaal (vendor-panel) — Vercel deploy

Deploy the Mercur vendor panel at `verkoper.hobbysalon.be`.

## 1. Create Vercel project

1. Import the HOBBYSALON monorepo in Vercel.
2. Create a new project (e.g. `hobbysalon-vendor-panel`).
3. Set **Root Directory** to `apps/vendor-panel`.
4. Framework preset: **Vite**.
5. Build command: `yarn build:preview` (or `npm run build:preview`).
6. Output directory: `dist`.

## 2. Environment variables

| Variable | Value |
|----------|-------|
| `VITE_MEDUSA_BACKEND_URL` | `https://api.hobbysalon.be` |
| `VITE_MEDUSA_BASE` | `/` |
| `VITE_MEDUSA_STOREFRONT_URL` | `https://www.hobbysalon.be` |
| `VITE_PUBLISHABLE_API_KEY` | Medusa publishable key |
| `VITE_DISABLE_SELLERS_REGISTRATION` | `true` |

## 3. DNS

Add a CNAME record:

```text
verkoper.hobbysalon.be → cname.vercel-dns.com
```

Assign the domain in the Vercel project settings.

## 4. VPS backend CORS

After DNS is live, update `deploy/vps/.env` on the API server:

```text
VENDOR_CORS=https://verkoper.hobbysalon.be
AUTH_CORS=...,https://verkoper.hobbysalon.be
VENDOR_PANEL_URL=https://verkoper.hobbysalon.be
PLATFORM_SUPABASE_ANON_KEY=<supabase anon key>
```

Redeploy the backend container.

## 5. Storefront env

On the storefront Vercel project, add:

```text
VENDOR_PANEL_URL=https://verkoper.hobbysalon.be
```

## 6. Smoke test

1. Log in on `www.hobbysalon.be` as a merchant with a seller link.
2. Open **Verkopersportaal** in the dashboard nav.
3. Confirm redirect to `verkoper.hobbysalon.be` and vendor orders view loads.
4. Test Stripe Connect onboarding from the vendor panel payouts section.

## 7. Backfill existing sellers (one-time)

On the VPS, after deploying the auth bridge:

```bash
medusa exec ./src/scripts/backfill-seller-auth-identities.ts
```
