# Hobbysalon.nl — productiechecklist (domeinconfiguratie)

Beide domeinen gebruiken **dezelfde** Vercel-storefront, hetzelfde Supabase-project en dezelfde Medusa-API (`api.hobbysalon.be`). Geen tweede backend.

NL blijft uitgeschakeld tot aparte lanceringgoedkeuring. Cloudflare 301 `.nl` → `.be` blijft voorlopig actief.

## Vercel — beide domeinen op één storefront

1. Domains: `hobbysalon.nl` en `www.hobbysalon.nl` toevoegen (naast bestaande `.be`).
2. DNS naar Vercel zoals in de Domains-UI (registrar of Cloudflare DNS).
3. TLS voor beide hosts bevestigen.
4. Gedeelde env (ongewijzigd voor backends):
   - `NEXT_PUBLIC_SUPABASE_URL` / anon key
   - `MEDUSA_BACKEND_URL=https://api.hobbysalon.be`
   - `NEXT_PUBLIC_SITE_URL=https://www.hobbysalon.be` (Belgische fallback)
5. Productie: **niet** `ENABLE_NL_MARKET=true` zetten zonder `ALLOW_NL_MARKET_IN_PRODUCTION=true` én expliciete goedkeuring.
6. Indexering blijft uit zolang `MARKETS.NL` `preparing` / `noindex` is (codeconfig, aparte launch-PR).

## Cloudflare — redirect voorlopig laten staan

1. De bestaande 301 van `hobbysalon.nl` → `hobbysalon.be` **niet** uitzetten in deze fase.
2. Domeinkoppeling en auth/CORS kunnen alvast klaarstaan achter de redirect.
3. Redirect pas later uitzetten bij goedgekeurde NL-lancering (aparte stap).

## Supabase Auth — redirect allowlist

Toevoegen onder Authentication → URL configuration (nu al mogelijk; schaadt `.be` niet):

- `https://hobbysalon.nl/auth/confirm`
- `https://www.hobbysalon.nl/auth/confirm`
- Bestaande `https://www.hobbysalon.be/auth/confirm` behouden

Site URL mag `https://www.hobbysalon.be` blijven. Confirm/reset-links volgen het request-host.

## Medusa / VPS — CORS

In `deploy/vps/.env` (voorbeeld: `.env.example`):

- `STORE_CORS` / `AUTH_CORS` / `ADMIN_CORS`: `https://hobbysalon.nl`, `https://www.hobbysalon.nl`
- Bestaande `.be` en `verkoper.hobbysalon.be` behouden
- Backend herdeployen via het normale goedkeuringsproces

## Gecontroleerde NL-lancering (later, aparte goedkeuring)

1. Staging: `ENABLE_NL_MARKET=true` (preview) — auth-links op `.nl`, SEO nog noindex.
2. Productie pas na goedkeuring:
   - `ENABLE_NL_MARKET=true`
   - `ALLOW_NL_MARKET_IN_PRODUCTION=true`
   - `MARKETS.NL` → `rollout: "live"`, `indexing: "index"` (codewijziging)
   - Cloudflare 301 uitzetten
3. Sitemap / robots / hreflang op `.nl` nalopen.

## Niet doen in deze changeset

- Geen merge of deployment
- Geen DNS- of Cloudflare-wijzigingen uitvoeren
- Geen databasewijzigingen
- Geen tweede Supabase/Medusa-project
- Geen cross-domain SSO
