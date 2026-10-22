# Hobbysalon.nl — live checklist

Both domains use the **same** Vercel storefront project, Supabase project, and Medusa API (`api.hobbysalon.be`). Do not create a second backend.

## Vercel — domain koppeling

1. Storefront project → **Domains**: add `hobbysalon.nl` and `www.hobbysalon.nl`.
2. Point DNS (at the registrar / Cloudflare DNS-only) to Vercel as instructed in the Domains UI.
3. Confirm TLS is issued for both hosts.
4. Keep existing `www.hobbysalon.be` / `hobbysalon.be` unchanged.
5. Env (same project, both hosts):
   - `NEXT_PUBLIC_SUPABASE_URL` / anon key — unchanged (shared)
   - `MEDUSA_BACKEND_URL=https://api.hobbysalon.be` — unchanged
   - `NEXT_PUBLIC_SITE_URL=https://www.hobbysalon.be` — keep as Belgian fallback for SEO helpers and emails outside a request
   - Do **not** set `ENABLE_NL_MARKET=true` on Production until the launch steps below

## Cloudflare — redirect uitschakelen

1. Find the rule that redirects `hobbysalon.nl` → `hobbysalon.be` (or similar).
2. Disable or delete that redirect **after** Vercel serves `.nl` correctly.
3. Prefer DNS-only (grey cloud) or proxied without path redirects; avoid forcing `.nl` → `.be`.
4. Smoke-test `https://hobbysalon.nl/` returns the storefront (not a 301 to `.be`).

## Supabase Auth — redirect allowlist

Add (Authentication → URL configuration):

- `https://hobbysalon.nl/auth/confirm`
- `https://www.hobbysalon.nl/auth/confirm`
- Keep existing `https://www.hobbysalon.be/auth/confirm` (and apex if used)

Site URL may stay `https://www.hobbysalon.be`; confirm links are built per request host.

## Medusa / VPS CORS

On the API server `.env`, include `.nl` in `STORE_CORS`, `AUTH_CORS`, and `ADMIN_CORS` (see `deploy/vps/.env.example`), then redeploy the backend with the normal approval flow.

## Gecontroleerde NL-lancering (apart van deze PR)

1. Staging: `ENABLE_NL_MARKET=true` with `VERCEL_ENV=preview` — verify auth confirm/reset stay on `.nl`, SEO noindex while `MARKETS.NL` is `preparing`.
2. Code/config launch (explicit approval): allow `ENABLE_NL_MARKET` in production (today it is hard-blocked when `VERCEL_ENV=production`), set `MARKETS.NL` to `rollout: "live"` and `indexing: "index"`, then set `ENABLE_NL_MARKET=true` on Production.
3. Re-check sitemap/robots/hreflang on `.nl` after that change.

## Niet doen bij domeinkoppeling

- Geen tweede Supabase- of Medusa-project
- Geen wijziging aan checkout, iDEAL, voorraad of verzendlogica
- Geen automatische merge/deploy vanuit deze checklist
