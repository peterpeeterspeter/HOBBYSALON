# Integratieplan: listing-first model

Uitvoeringsplan voor de omslag van commissie-op-verkoop naar listing fees voor makers, workshops en events. Merchants blijven ongewijzigd op Medusa.

Achtergrond en cijfers: `docs/pricing-model-comparison.md`.

---

## Vastgelegde beslissingen

Deze staan vast voordat er code geschreven wordt. Ze zijn commercieel, niet technisch.

1. **Makers verlaten Medusa.** Geen cart, geen checkout, geen Stripe Connect voor makers. Publiceren kost een listing fee; contact loopt via een aanvraag op het platform.
2. **De 6% commissie op handmade vervalt.** Een maker die één stuk van €300 verkoopt betaalt vandaag €18, straks €0,50. Bewust: kleine verkopers betalen meer per euro omzet, hoog-ticket verkopers veel minder.
3. **Merchants blijven volledig op Medusa** — voorraad, verzending, Stripe Connect, 10% commissie op `supply`. Dit is de enige rol die de commerce-backend rechtvaardigt.
4. **Workshops en events blijven in eigen tabellen.** Ze worden niet in `products` geduwd; ze delen alleen het entitlement- en aanvraagpatroon.
5. **Eén creditmunt** voor alle plaatsingen en upsells, 1 credit ≈ €0,50.

---

## Twee stacks

| Rol | Listing | Stack | Geld |
|---|---|---|---|
| Hobbyist / Maker | afgewerkt stuk (`handmade`) | Supabase | 1 credit |
| Hobbyist / Maker | restant materiaal (`destash`) | Supabase | 1 credit |
| Workshopgever | workshop | Supabase | 30 credits |
| Organisator | makersmarkt (`handmade_market`) | Supabase | 30 credits |
| Organisator | hobbybeurs (`hobby_fair`) | Supabase | 200 credits |
| **Merchant** | `supply` | **Medusa + Connect** | **10% commissie** |

`destash` moet een eigen `product_type` worden en mag niet op `supply` liften: `supply` is precies de waarde waar de 10%-commissieregel op matcht, en een hobbyist met restjes garen hoort niet in dat commissiepad. Het is bovendien eerlijker naar de koper — restant van een hobbyist is een andere belofte dan nieuw van een winkel.

---

## Fase 0 — Schemafundament

Dit blokkeert al de rest.

### 0.1 Prijskolom op `products` (harde blocker)

`products` heeft **geen prijsveld**. Prijs leeft nu uitsluitend in Medusa; `createProductAction` neemt `price_cents` uit het formulier en stuurt het door naar Medusa zonder het op te slaan. Zodra makers Medusa verlaten, is er geen plaats voor de vraagprijs.

```sql
alter table public.products
  add column if not exists price_cents integer,
  add column if not exists currency_code text not null default 'EUR';
```

Prijs wordt voor listings een **richtprijs**, niet een afrekenbedrag. Label in de UI als "richtprijs" / "vanaf", niet als winkelprijs.

### 0.2 `destash` als producttype

```sql
alter table public.products drop constraint products_product_type_check;
alter table public.products add constraint products_product_type_check check (
  product_type in (
    'supply','handmade','destash',
    'event_listing','event_ticket','workshop_ticket','workshop_kit'
  )
);
```

Ook bijwerken: `PRODUCT_TYPES` in `apps/storefront/src/app/actions/dashboard.ts:36`.

### 0.3 Vervaldatum op listings — niet uitgevoerd, nog open

Een betaalde plaatsing van €15 die eeuwig blijft staan is geen product. Idee was `listing_expires_at` op `products`/`workshops`, plus een opruimjob. Deze kolom is **nooit aangemaakt** (geverifieerd tegen de live database) — blijft open voor wanneer Fase 3 (betaalde per-listing plaatsingen) er is.

### 0.4 Aanvraagtabel — gebouwd als `product_inquiries`, niet `listing_inquiries`

Hier is parallel werk ontstaan: dit plan schetste een generieke `listing_inquiries`-tabel (product/event/creator gedeeld), maar de daadwerkelijke implementatie — gebouwd buiten deze sessie om, tegelijk met Fase 1 hierboven — koos een product-specifieke `product_inquiries`-tabel. Die is live, getest en heeft al e-mailnotificatie + dashboard-inbox (zie Fase 2). De generieke `listing_inquiries`-tabel/action zijn nooit toegepast op de database en zijn verwijderd uit de codebase. Als events later ook een aanvraagformulier krijgen, hergebruik dan het `product_inquiries`-patroon (kopiëren naar `event_inquiries`) in plaats van alsnog een generieke tabel te forceren — twee kleine, expliciete tabellen zijn hier duidelijker dan één polymorfe.

`workshop_booking_requests` blijft ongewijzigd bestaan — workshop-specifieke velden, werkt al, niet aangeraakt.

### 0.5 Credit-redenen uitbreiden — niet uitgevoerd, nog open

De check-constraint op `listing_credit_transactions.reason` staat live nog altijd op alleen `purchase`, `listing_create`, `listing_bump`, `spotlight`, `refund`, `manual_adjustment` (geverifieerd via `pg_constraint`). Nodig zodra workshop-/event-plaatsingen credits gaan verbruiken:

```sql
alter table public.listing_credit_transactions
  drop constraint listing_credit_transactions_reason_check;
alter table public.listing_credit_transactions
  add constraint listing_credit_transactions_reason_check check (
    reason in (
      'purchase','listing_create','listing_bump','spotlight','refund','manual_adjustment',
      'workshop_publish','event_publish','exhibitor_outreach','newsletter_feature'
    )
  );
```

### 0.6 Wallet voor hobbyisten

`listing_credit_wallets.creator_id` verwijst naar `creators(id)`. Een hobbyist die één keer restjes verkoopt is geen creator. Eenvoudigste route zonder FK-breuk: bij de eerste plaatsing automatisch een lichtgewicht `creators`-rij aanmaken met `creator_types = '{maker}'` en `is_verified = false`. Geen nieuwe wallet-tabel, geen user-scoped variant.

---

## Fase 1 — Maker los van Medusa ✅ uitgevoerd

**Bestanden:** `apps/storefront/src/app/actions/dashboard.ts`, `apps/storefront/src/lib/services/product-page.ts`, `apps/storefront/src/components/product/ProductBuyCard.tsx`, `apps/storefront/src/app/(dashboard)/dashboard/products/page.tsx`, `apps/storefront/src/lib/commerce/medusa/creator-products.ts`

1. `createProductAction` schrijft nu rechtstreeks naar `products` (`handmade` én `destash`) — geen `createCreatorMarketplaceProduct`-aanroep meer. Die functie had ook geen eigen platform-writeback: het platformrecord ontstond voorheen via een Medusa-subscriber (`platform-products-projection.ts` in `packages/modules/b2c-core`) na een Algolia `PRODUCTS_CHANGED`-event. Die hele keten is nu overbodig voor maker-listings; `createCreatorMarketplaceProduct` zelf is verwijderd (geen resterende aanroepers).
2. `updateProductAction` behoudt het Medusa-pad uitsluitend voor rijen met een bestaande `medusa_product_id` (legacy, van vóór deze cutover). Prijs wordt nu ook echt bijgewerkt (`price_cents`/`currency_code`), met behoud van de bestaande waarde als het veld leeg blijft.
3. `product-page.ts`: prijs komt voor `handmade`/`destash` rechtstreeks uit `products.price_cents`. Medusa-lookup blijft alleen voor `supply` én voor legacy maker-rijen die nog een `medusa_product_id` hebben (zodat lopende orders niet breken — Fase 5-principe). De lazy Medusa-autoprovisioning (`ensurePurchasableMedusaProductId` + bijbehorende helpers) is verwijderd.
4. `ProductBuyCard` toont voor maker-listings zonder cart een aanvraagformulier (`ProductInquiryForm`, nieuw) in plaats van `ProductPurchaseControls`. "Veilig betalen via Hobbysalon" en "Verzonden door" zijn vervangen door "Rechtstreeks contact met de maker" — niet meer misleidend nu er geen transactie is.
5. Dashboard `/dashboard/products`: `destash` toegevoegd als type-optie, het overbodige "voorraadmodus"-veld (mapte alleen op Medusa `manage_inventory`, nu zonder bestemming) verwijderd uit beide formulieren, en het richtprijsveld bij bewerken toont eindelijk de echte waarde (kon voorheen niet, want er was geen kolom).

**Kanttekening:** dit is grotendeels parallel gebouwd — deze sessie deed Fase 0 (schema) en de kern van Fase 1 (`createProductAction`/`updateProductAction`/`product-page.ts`/`ProductBuyCard`-architectuur), en onafhankelijk daarvan is er tegelijk verder gewerkt op de `ux/hobbysalon-platform-redesign`-branch (`product_inquiries`, e-mail, RLS-fix, dashboard-inbox). Beide zijn via PR #27 en #29 in `main` gemerged, met een expliciete merge-conflictresolutie die de architectuur van deze sessie behield maar de aanvraag-implementatie van de andere branch koos. Zie Fase 2.

---

## Fase 2 — Aanvraagstroom en inbox ✅ live, geverifieerd tegen productie-Supabase

**Gebouwd (buiten deze sessie, tegelijk met Fase 1):**

- `apps/storefront/scripts/migrate-handmade-listings.sql` — `product_inquiries`-tabel, RLS insert-only voor anon/authenticated (`7cc3401b1` scherpte dit aan: de open `FOR ALL`-policy is weg).
- `apps/storefront/src/app/actions/product-inquiry.ts` — `submitProductInquiry` (insert) + `updateProductInquiryStatusAction` (dashboard, ownership via `creator_id`).
- `apps/storefront/src/components/product/ProductInquiryForm.tsx` — formulier, toont `creatorName`.
- `apps/storefront/src/lib/platform/notifications/product-inquiry-email.ts` — Resend-notificatie naar de maker bij een nieuwe aanvraag.
- Inbox zit inline in `/dashboard/products` (geen aparte `/dashboard/aanvragen`-route).

**Geverifieerd (2026-07-25, rechtstreeks tegen Supabase-project `urjpkzbjjqgwztcsnzys`):**

- `product_inquiries` bevat de smoke-rij: AT Tester → product "AT contact listing" (`at-contact-listing-smoke`, `product_type=handmade`, `medusa_product_id=null`) → creator Peter Peeters. Koppeling klopt end-to-end.
- RLS op `product_inquiries`: precies één policy, `product_inquiries_anon_insert` (INSERT, anon+authenticated). Geen open `FOR ALL` meer — de fix staat echt live.
- **Gevonden gat:** de creator-rij van Peter Peeters heeft `email = null`. `sendProductInquiryCreatorEmail` wordt alleen aangeroepen `if (creator?.email)` — voor deze specifieke smoke-test is er dus **geen mail verstuurd**, ook al is de code correct. Zet een e-mailadres op het creator-profiel om de notificatie echt te testen.

**Geen chat.** Er bestaat geen messaging-tabel; realtime chat betekent notificaties, moderatie, spam, blokkeren en misbruikmeldingen bouwen. Voor een publiek van 55–74 (PRD: 60%) is e-mailnotificatie + in-platform antwoord vertrouwder én een fractie van het werk. Threading kan later.

**Opruiming deze sessie:** de generieke `listing_inquiries`-tabel/migratie/action (nooit toegepast op de database) zijn verwijderd. `docs/SQL.md`/`docs/schema.md` beschreven ook `listing_expires_at` en een dubbele `price_cents`/`currency_code`-declaratie in `products` — beide waren merge-artefacten die niet overeenkwamen met de live schema en zijn gecorrigeerd op basis van een rechtstreekse `information_schema`/`pg_constraint`-query.

---

## Fase 3 — Betaalde checkout ✅ code klaar, wacht op echte Stripe-sleutels

Dit is de fase waar geld echt binnenkomt. Beslissingen bevestigd met de gebruiker vooraf: **eigen Stripe-key op de storefront** (los van Medusa en van Connect — Connect blijft uitsluitend merchant-payouts), en **`price_data` dynamisch** vanuit `listing_credit_products`/`commercial_plans` (geen vooraf aangemaakte Stripe Price-objecten nodig).

**Gebouwd:**

1. `apps/storefront/src/lib/payments/stripe-client.ts` — Stripe-client + webhook-secret helpers, apart van Medusa/Connect.
2. `apps/storefront/src/app/actions/listing-checkout.ts` — `createCreditPackCheckoutAction` en `createPlanCheckoutAction`. Beide: `mode: "payment"` (eenmalige afrekening, geen Stripe Subscription — past bij "vaste jaarprijs" zonder recurring-billingcomplexiteit). Organizer-plannen worden expliciet geweigerd (`segment === "organizer"` faalt met duidelijke boodschap) — die horen bij een event, niet bij de creator, en zijn Fase 4-werk.
3. `apps/storefront/src/app/api/webhooks/stripe-listing/route.ts` — verifieert de signature, verwerkt alleen `checkout.session.completed` met `payment_status === "paid"`. **Idempotent**: schrijft eerst de Stripe session-id naar `stripe_checkout_events` (nieuwe tabel, `apps/storefront/scripts/migrate-listing-checkout.sql`); bij een unique-violation is het event al verwerkt en stopt de handler. Credits gaan via `apply_listing_credit_delta` (atomair, uit Fase 0). Plannen deactiveren eerst een bestaand actief abonnement in hetzelfde segment, dan insert in `creator_plan_subscriptions` met `external_payment_id = session.id`.
4. `addListingCreditsAction` (`dashboard.ts`) is dichtgetimmerd: vereist nu `isModerator(user.id)`, een expliciete `creator_id` van een andere maker, en gebruikt reden `manual_adjustment` in plaats van `purchase` — zodat de audit trail een handmatige correctie nooit kan verwarren met een echte betaling. Nergens meer bereikbaar voor een creator over zijn eigen account.
5. UI: `/dashboard/products` toont saldo + koopbare pakketten, gekoppeld aan `createCreditPackCheckoutAction`.

**Nog te doen — dit kan alleen jij, ik heb geen toegang tot je Stripe-dashboard of live sleutels:**

- `stripe` package toegevoegd aan `package.json` (`^17.4.0`) maar **niet geïnstalleerd** in deze sandbox (geen `node_modules`, geen netwerktoegang om te verifiëren) — draai `yarn install` en dan `yarn build` vóór deploy. De `apiVersion`-string in `stripe-client.ts` is een educated guess; als de build een literal-type-mismatch geeft op dat veld, kopieer de waarde die TypeScript voorstelt.
- Env vars instellen op de storefront-deployment (Vercel): `STRIPE_SECRET_API_KEY`, `STRIPE_LISTING_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL` (laatste bestaat vermoedelijk al, hergebruikt van `seo.ts`).
- In Stripe: een webhook-endpoint aanmaken naar `<site>/api/webhooks/stripe-listing` voor het event `checkout.session.completed`, en het bijbehorende signing secret in `STRIPE_LISTING_WEBHOOK_SECRET` zetten.
- Migratie draaien: `apps/storefront/scripts/migrate-listing-checkout.sql`.
- **Test-mode end-to-end proberen** (creditpakket kopen → Stripe test-kaart → webhook komt binnen → credits verschijnen) — dit is code die ik nooit heb kunnen draaien, alleen gebouwd en type-gecontroleerd. Behandel de eerste live test als een echte test, niet als een formaliteit.
- Pas daarna `COMMERCIAL_GATING_ENABLED=true`.

De creditkant blijft atomair afgedwongen op databaseniveau (`apply_listing_credit_delta`), dus dubbele webhooks of gelijktijdige publicaties kunnen het saldo niet corrumperen — en nu ook: dubbele webhook-*events* kunnen niet dubbel crediteren, dankzij `stripe_checkout_events`.

---

## Fase 4 — Events en exposantenwerving ✅ uitgevoerd

**Belangrijk vóór het lezen:** de gebruiker heeft bevestigd dat vandaag **alles gratis is** — `COMMERCIAL_GATING_ENABLED` staat op `false`, dus geen enkele credit-check hieronder blokkeert momenteel iets. Deze fase bouwt de backend-infrastructuur die klaarstaat voor wanneer gating later aangaat, exact zoals Fase 0–3.

### 4.1 Prijs per eventtype

`events.event_type` had de differentiatie al in het schema (`handmade_market`, `hobby_fair`, `pop_up`, `open_atelier`, `workshop_day`) — geen schemawijziging nodig. `EVENT_CREDIT_COSTS` in `listing-credits.ts`: `pop_up`/`open_atelier` 15 credits, `workshop_day`/`handmade_market` 30 credits, `hobby_fair` 200 credits. Nieuw: `enforceEventPublishCredits` (`commercial-enforcement.ts`), gewired in `createEventAction` — identiek patroon aan `enforceHandmadePublishCredits` (no-op zolang gating uit staat).

### 4.2 Exposantenwerving

**Ontwerpkeuze tijdens de bouw:** `event_domains` wordt nergens vanuit het dashboard geschreven — organisatoren kunnen vandaag geen domein aan hun event koppelen. Domein-matching zou dus altijd leeg blijven. V1 target daarom **alle** opt-in makers (`creators.open_to_markets = true` én `'maker' in creator_types`), zonder domeinfilter. Domein-scoping is een zinvolle verfijning zodra event-domeinselectie in de UI bestaat, niet eerder.

**Verkoopt nooit contactgegevens** (GDPR): de organizer betaalt credits (`LISTING_CREDIT_COSTS.exhibitorOutreach = 200`, `apps/storefront/src/app/actions/exhibitor-outreach.ts`) om een e-mailoproep te sturen naar opt-in makers (Resend, `exhibitor-outreach-email.ts`). Reageert een maker, dan doet die dat via het **bestaande** `event_vendor_inquiries`-inbound-formulier op de publieke eventpagina (`/agenda/[slug]#standhouders`, nieuw anker) — de maker deelt zijn eigen gegevens zelf, precies zoals gepland. Geen nieuwe responstabel nodig: het bestaande organizer-inbox op `/dashboard/events` toont deze reacties al.

Nieuw: `creators.open_to_markets` (opt-in-checkbox op het makerprofiel, `CreatorProfileTab.tsx`), `event_exhibitor_outreach` (auditlog van verstuurde oproepen — bewaart geen ontvangerslijst, alleen aantal + kosten).

---

## Fase 5 — Migratie van bestaande data ✅ deels uitgevoerd

**Eerst de cijfers, geverifieerd tegen productie (2026-07-26):** van de 26 `handmade`-rijen hebben er **25 nog een `medusa_product_id`**. Dit is dus geen randgeval maar de meerderheid van de echte data. Reden te meer om niets in bulk aan te raken.

1. ✅ Nieuwe Medusa-aanmaak stop (Fase 1) — vanaf dan groeit de oude set niet meer.
2. ✅ Lopende Medusa-orders lopen normaal uit — hier is niets aan veranderd, geen actie nodig.
3. ✅ **Backfill-script geschreven**: `apps/storefront/scripts/backfill-handmade-price-cents.ts`. Vult `price_cents`/`currency_code` op legacy rijen vanuit de Medusa Store API-prijs (dezelfde bron als `product-page.ts` gebruikt). Puur additief: raakt alleen rijen waar `price_cents` nog `null` is, wijzigt nooit `medusa_product_id`. **Kon niet zelf uitgevoerd worden** — vereist `MEDUSA_BACKEND_URL`/`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` waar deze sessie geen toegang toe heeft. Draai met `--dry-run` eerst om te zien wat er zou gebeuren.
4. **Nog open, bewust niet geautomatiseerd**: rijen omzetten naar pure contact-listings (`medusa_product_id` naar `null`) zodra er geen open orders meer zijn. Of een product open orders heeft, staat niet in de Supabase-platformdatabase — dat weet alleen Medusa's eigen orders-tabel, waar ik in deze sessie geen toegang toe heb. Dit blijft een **handmatige beslissing per rij**, precies zoals hierboven gewaarschuwd: niet in bulk deactiveren.
5. ✅ **Onnodige Medusa-sellerprovisioning verwijderd uit het makerpad** — belangrijke precisering: de gevonden koppeling was niet letterlijk "Stripe Connect" maar Medusa-**sellerregistratie** (`/admin/platform/creators/register`, maakt een Mercur-seller + shipping profile aan). 16 dashboard-acties die niets met commerce te maken hebben (portfolio-afbeeldingen, artikels, project-materialen, workshop-productkoppelingen, boekingsstatus) riepen toch de zware `getRequiredCreator()` aan — die forceert deze Medusa-sellerprovisioning puur om een `creator`-object op te halen dat ze al via de lichte `getRequiredCreatorProfile()` konden krijgen (geverifieerd: geen van de 16 gebruikt `sellerId`). Alle 16 omgezet naar `getRequiredCreatorProfile()`. Een pure maker die nooit fysiek verkoopt, krijgt nu geen Medusa-sellerrecord meer opgedrongen bij het schrijven van een artikel.
6. ✅ **`/dashboard/orders` scoping gefixt** — `canManageOrders` in `dashboard-access.ts` stond op `canManageProducts || ...`, wat betekende dat *elke* maker (ook zuivere platform-only-listinghouders zonder ooit een Medusa-order) de "Bestellingen"-pagina te zien kreeg, altijd leeg. Nu: `hasCreatorSellerLink || hasMerchantSellerLink` — alleen wie een echte Medusa-sellerkoppeling heeft (legacy makers of merchants) ziet deze pagina.

Dubbelrol werkt al: `creators.creator_types` is een array en `user_account_roles` bestaat. Een maker die doorgroeit tot merchant krijgt de rol erbij op dát moment. Dat is meteen het verhaal: *begin met plaatsen, upgrade naar verkopen wanneer je er klaar voor bent.*

---

## Documentatie bijwerken

- `docs/billing-commission-matrix.md` — handmade is listing fee, niet 6%. `destash` toevoegen. `event_listing` / `event_ticket` / `workshop_ticket` staan nog op placeholder €1 in `apps/backend/src/scripts/seed/seed-functions.ts`; die stubs zijn niet langer nodig voor publicatiekosten.
- `apps/storefront/src/app/(public)/voor-makers/page.tsx` — "6% commissie op handmade verkoop" klopt niet meer.
- Prijzen op de publieke pagina's lopen sowieso uiteen met de seed: `voor-workshopgevers` toont een tier "Tracked" van €390 die niet in `seed-commercial-plans.sql` staat, en `voor-winkels` toont €29/maand terwijl de seed `supplier_premium` op €490/jaar zet.

---

## Volgorde en risico

| Fase | Blokkeert | Risico als overgeslagen |
|---|---|---|
| 0 | alles | Geen prijsopslag → listings zonder prijs |
| 1 | 2, 5 | — |
| 2 | 3 | Betaalde listing zonder aantoonbare waarde |
| 3 | gating | Gratis credits, of publiceren zonder betaalmogelijkheid |
| 4 | — | Loopt parallel aan 2–3 |
| 5 | — | Kan pas na 1 |

Twee dingen die niet mogen schuiven: **prijskolom vóór Fase 1**, en **werkende checkout vóór `COMMERCIAL_GATING_ENABLED=true`**.
