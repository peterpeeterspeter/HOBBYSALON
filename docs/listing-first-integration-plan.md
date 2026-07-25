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

### 0.3 Vervaldatum op listings

Een betaalde plaatsing van €15 die eeuwig blijft staan is geen product. Nodig voor "90 dagen geldig":

```sql
alter table public.products add column if not exists listing_expires_at timestamptz;
alter table public.workshops add column if not exists listing_expires_at timestamptz;
```

Plus een opruimjob die verlopen listings op `is_active = false` zet.

### 0.4 Generieke aanvraagtabel

Volgt het bestaande patroon van `workshop_booking_requests` (`docs/SQL.md:1002`), maar generiek zodat product-, event- en toekomstige listings dezelfde inbox delen:

```sql
create table if not exists public.listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  creator_id uuid not null references public.creators(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_inquiries_entity_type_check check (
    entity_type in ('product','event','creator')
  ),
  constraint listing_inquiries_status_check check (
    status in ('new','read','replied','archived','spam')
  )
);

create index if not exists idx_listing_inquiries_creator_id on public.listing_inquiries(creator_id);
create index if not exists idx_listing_inquiries_entity on public.listing_inquiries(entity_type, entity_id);
create index if not exists idx_listing_inquiries_status on public.listing_inquiries(status);
```

`workshop_booking_requests` blijft bestaan — die heeft workshop-specifieke velden en werkt al. Niet migreren.

### 0.5 Credit-redenen uitbreiden

De check-constraint op `listing_credit_transactions.reason` laat vandaag alleen `purchase`, `listing_create`, `listing_bump`, `spotlight`, `refund`, `manual_adjustment` toe. Nieuwe plaatsingstypes vallen erbuiten en zouden de transactie laten falen:

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

**Nog niet gedaan (bewust, hoort bij latere fases):** notificatiemail bij een nieuwe aanvraag, en de dashboard-inbox om aanvragen te beheren (`updateBookingRequestStatusAction`-equivalent voor `listing_inquiries`) — zie Fase 2 hieronder. De aanvraag zelf werkt al end-to-end (formulier → insert → RLS-validatie), want zonder werkende insert had `ProductBuyCard` niets om naartoe te sturen.

---

## Fase 2 — Aanvraagstroom en inbox

**Al gedaan (vervroegd, nodig voor Fase 1):** `apps/storefront/src/app/actions/listing-inquiry.ts` (server action, patroon van `workshop-booking.ts`) en `apps/storefront/src/components/product/ProductInquiryForm.tsx` (patroon van `WorkshopBookingRequestForm`). RLS: anon mag `insert` met dezelfde strenge `with check` als `workshop_booking_requests`; alleen de eigenaar-creator mag `select`/`update`.

**Nog open:**

- Notificatiemail naar de maker bij een nieuwe aanvraag: **"je hebt een aanvraag, log in om te antwoorden"** — niet de volledige inhoud, niet het e-mailadres van de bezoeker.
- Dashboardpagina `/dashboard/aanvragen` om `listing_inquiries` te bekijken en status bij te werken (mirror van `updateBookingRequestStatusAction`).

Dat eerste punt is geen controledwang maar het verlengingsargument: zonder in-platform antwoord heb je bij de jaarfactuur geen enkel bewijs van waarde. Mét: *"je kreeg 12 aanvragen deze maand."*

**Geen chat.** Er bestaat vandaag geen enkele messaging-tabel; realtime chat betekent notificaties, moderatie, spam, blokkeren en misbruikmeldingen bouwen. Voor een publiek van 55–74 (PRD: 60%) is e-mailnotificatie + in-platform antwoord vertrouwder én een fractie van het werk. Threading kan later.

---

## Fase 3 — Betaalde checkout

Dit is de fase waar geld echt binnenkomt, en de fase met het grootste risico.

**`addListingCreditsAction` (`dashboard.ts:2239`) kent vandaag credits toe zonder enige betaling.** Het is een kale server action met een `pack_code` en geen Stripe-aanroep. Vandaag niet uitbuitbaar omdat gating uit staat (`COMMERCIAL_GATING_ENABLED` is standaard `false`) en er geen UI aan hangt — maar het moment dat gating aangaat en deze action bereikbaar is, kan iedereen zichzelf gratis credits geven.

Volgorde, strikt:

1. Stripe Checkout Session voor creditpakketten en jaarplannen (platform charge — **geen** Connect; Connect blijft merchant-only).
2. Webhook `checkout.session.completed` → `apply_listing_credit_delta` voor packs, of `creator_plan_subscriptions` voor plannen.
3. `addListingCreditsAction` afsluiten: alleen bereikbaar voor moderators als handmatige correctie, met reden `manual_adjustment`.
4. Pas daarna `COMMERCIAL_GATING_ENABLED=true`.

Omgekeerde volgorde betekent: publiceren geblokkeerd terwijl niemand kán betalen.

De creditkant is klaar — `apply_listing_credit_delta` is atomair en afgedwongen op databaseniveau, dus dubbele webhooks of gelijktijdige publicaties kunnen het saldo niet corrumperen.

---

## Fase 4 — Events en exposantenwerving

### 4.1 Prijs per eventtype

`events.event_type` heeft de differentiatie al in het schema: `handmade_market`, `hobby_fair`, `pop_up`, `open_atelier`, `workshop_day`. Geen schemawijziging nodig — alleen een tarieventabel die `event_type` op credits mapt. Een `hobby_fair` kost een veelvoud van een `handmade_market`.

### 4.2 Exposantenwerving (het hoogste-marge product)

Een organisator die 40 standen à €200 vult, draait €8.000. €99–249 betalen om 200 relevante makers te bereiken is triviaal.

**Verkoop nooit contactgegevens.** Dat is niet toegestaan onder GDPR — makers hebben daar geen toestemming voor gegeven. Bouw het omgekeerd:

```sql
alter table public.creators add column if not exists open_to_markets boolean not null default false;
```

1. Opt-in op het makerprofiel: *"Ik sta open voor markten en beurzen"*.
2. Organisator betaalt credits om een oproep te sturen naar matchende opt-in makers, **via het platform**.
3. Makers die willen, antwoorden — en geven hun gegevens daarmee zelf vrij.

Compliant, en operationeel beter: het gesprek blijft meetbaar op het platform. `event_vendor_inquiries` dekt de inkomende richting (standhouder → organisator) al; dit is de uitgaande richting en moet nieuw.

---

## Fase 5 — Migratie van bestaande data

Bestaande handmade-producten met een `medusa_product_id` hebben mogelijk lopende orders of open winkelmandjes. **Niet in bulk deactiveren.**

1. Zet nieuwe Medusa-aanmaak stop (Fase 1) — vanaf dan groeit de oude set niet meer.
2. Laat lopende Medusa-orders normaal uitlopen.
3. Vul `price_cents` op bestaande rijen vanuit de Medusa-prijs (eenmalig backfill-script).
4. Zet de resterende rijen om naar contact-listings zodra er geen open orders meer zijn.
5. Maker-onboarding voor Stripe Connect uit het makerpad halen; Connect blijft merchant-only.
6. `/dashboard/orders` alleen voor merchants en dubbelrollen.

Dubbelrol werkt al: `creators.creator_types` is een array en `user_account_roles` bestaat. Een maker die doorgroeit tot merchant krijgt de rol erbij en doorloopt Connect-onboarding op dát moment. Dat is meteen het verhaal: *begin met plaatsen, upgrade naar verkopen wanneer je er klaar voor bent.*

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
