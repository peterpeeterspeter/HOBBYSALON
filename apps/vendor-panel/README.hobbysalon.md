# Hobbysalon vendor panel

Mercur 1.5.4 vendor-panel fork for `verkoper.hobbysalon.be`.

## Local development

```bash
cp .env.example .env
yarn install
yarn dev
```

Default port: Vite dev server (typically `5173` unless configured).

Point `VITE_MEDUSA_BACKEND_URL` at `http://localhost:9000` or `https://api.hobbysalon.be`.

## Auth

Sellers do not register here directly (`VITE_DISABLE_SELLERS_REGISTRATION=true`).
Use the storefront handoff at `www.hobbysalon.be/dashboard/verkoper`.

Custom route: `/login/callback?token=<seller-jwt>` stores the Medusa token and opens `/orders`.

## Deploy

See `deploy/verkoper-vercel.md`.
