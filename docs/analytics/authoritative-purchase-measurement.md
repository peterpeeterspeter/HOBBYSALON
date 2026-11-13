# Authoritative purchase measurement — Checkout_completed / purchase

Status: analysis only. Nothing in this document has been deployed or merged.

## 1. Why the current event is not a purchase

`checkout_completed` is fired from a client component on the success page:

- `apps/storefront/src/app/(public)/checkout/success/page.tsx` renders
  `<TrackOnMount event="checkout_completed" ... />`
- `TrackOnMount` calls `trackEvent(event, payload, { google: false })`
- `lib/analytics/track.ts` maps it to `checkout_completed`, funnel stage `purchase`

The code already says this itself, in `lib/analytics/ga4.ts`:

```
// A checkout-success render is not yet authoritative purchase evidence.
checkout_completed: { item_count: count },
```

Three concrete reasons it cannot be trusted as revenue:

1. **It is a page render, not a payment confirmation.** Anyone who reaches
   `/checkout/success?order=<any-id>` trips the event. The page does call
   `verifyCheckoutSuccessOrder(orderId)`, so a *rendered* success page means the
   order set exists — but existence of an order set is not proof of capture
   (see §2), and the render still happens in the buyer's browser.

2. **It is client-side and consent-gated.** `trackEvent` only reaches Google via
   `sendGa4Event`, which returns early unless `analyticsAllowed()` is true —
   consent granted, GA ready, not disabled. A buyer who declines analytics is
   invisible. That is correct for privacy, but it means GA4 conversion counts
   will always under-report actual revenue, and the size of that gap is unknown.

3. **It is replayable/deletable.** `TrackOnMount` runs on mount; refresh the
   success page and it fires again. Browser-side numbers are therefore an upper
   bound on intent, not a revenue ledger.

Net effect: `checkout_completed` is a useful *funnel* signal (did the buyer reach
the thank-you page) but it must never be marked as a key event for revenue, and
it must not be renamed to `purchase`.

## 2. Where the real truth lives

There are two separate money paths, and they need different handling.

### 2a. Marketplace orders (Medusa / Stripe Connect) — the main revenue path

Authoritative moment: `apps/backend/src/utils/marketplace-payment-webhook.ts`

```
if (input.action === PaymentActions.SUCCESSFUL) {
  await captureMarketplacePaymentUnderLock(container, cart.id, expected)
}
```

This is the only place money is actually captured. It is wrapped in
`withCommerceCartLock`, re-reads durable state after a cached workflow result,
and validates amount / currency / payment-intent / payment-collection bindings
against the stored session before capturing. `assertCompletedCartOrderSet`
proves the order set matches the cart and the expected payment envelope.

This file is already the correct hook. It runs:
- only on a verified Stripe webhook (`PaymentActions.SUCCESSFUL`)
- only after the order set is proven consistent
- exactly once per successful capture (lock + durable re-read)

### 2b. Platform charges (workshop listing, credit packs, plans)

Authoritative moment: the Postgres RPC `fulfill_listing_checkout`
(`supabase/migrations/20260909120000_atomic_listing_checkout.sql`), called from
`apps/storefront/src/app/api/webhooks/stripe-listing/route.ts`.

It is already idempotent and correct:
- `insert ... on conflict (session_id) do nothing` serializes same-session deliveries
- returns `'applied'` only for the first real fulfillment
- returns `'duplicate'` for retries, `'legacy_blocked'` for unproven old markers
- all writes (wallet, ledger, marker) roll back together on failure

The route returns `{ received: true, duplicate: true }` for a duplicate. **Only
the `data === "applied"` branch is a real purchase.**

## 3. The Measurement Protocol constraint (this is the blocker)

To send a server-side GA4 event you need the Measurement Protocol, which needs:

- a **measurement ID** — `G-KP9BXCEF2Z` (confirmed on stream `4315375312`)
- an **API secret** — created manually in GA4 UI under
  Admin → Data streams → stream → Measurement Protocol API secrets.
  It is **not** readable via the Data or Admin API; I verified the Data/Admin
  client returns stream metadata only.
- a **`client_id`** to attribute the event to the browser session that converted

That third point is the real design problem. The current consent layer
deliberately never reads or forwards `_ga`:

`apps/storefront/src/app/analytics.test.ts`
```
assert.doesNotMatch(consent, /client_id\s*:|session_id\s*:/);
```

So an authoritative server event today has **no reliable join key** to the
person's analytics session. Options:

| Approach | Attribution | Privacy cost | Verdict |
|---|---|---|---|
| Send MP event with a random UUID as `client_id` | None — becomes a new "user" | none | **Rejected**: inflates user counts, creates ghost sessions, cannot join to the funnel |
| Read `_ga` cookie at capture time, store on the order, send server-side | Full | Must be consent-gated and disclosed | **Workable**, needs explicit consent plumbing |
| Send only aggregate/count events without `client_id` | Aggregate only | none | Cannot attribute to source/campaign, but honest totals |
| Do nothing server-side; keep client `checkout_completed` as funnel-only | Weak | none | **Current state**, and why you have no `purchase` |

Note that a marketplace buyer may also decline consent. Any server-side design
must therefore record *whether* consent existed, or it will silently mix
"consented, attributed" and "unconsented, unattributed" revenue.

## 4. Recommended design (not implemented)

### Step 1 — Stop treating a render as a purchase

Keep `checkout_completed` for funnel analysis, but:
- do **not** mark it a key event for revenue
- do **not** map it to GA4 `purchase`
- rename intent in reporting to "success page reached"

This is the honest fix and it costs nothing.

### Step 2 — Capture consent + `_ga` client ID at checkout start

At `checkout_started` (which already fires and already has the cart context),
if consent is granted, read the `_ga` cookie value
(`GA1.1.<random>.<timestamp>` → client_id is the `random.timestamp` pair),
and carry it forward on the order/session metadata rather than in GA4.

Guard: only when `analyticsAllowed()`. When consent is denied, store an explicit
`analytics_consent: "denied"` marker so the server knows not to count it as
attributed.

### Step 3 — Emit the server event from the proven capture point

**Marketplace:** in `marketplace-payment-webhook.ts`, inside the existing
`withCommerceCartLock` block, after `captureMarketplacePaymentUnderLock`
succeeds and after the final `assertCompletedCartOrderSet`. Emit a Medusa event
(e.g. `hobbysalon.order_captured`) — the Redis event bus is already configured
in `apps/backend/medusa-config.ts` when `redisUrl` is set.

**Platform charges:** in `stripe-listing/route.ts`, **only** in the
`if (data !== "applied") throw` / success branch — i.e. after `data === "applied"`.
The duplicate and legacy branches must never emit.

Then one subscriber sends the MP request:
`POST https://www.google-analytics.com/mp/collect?measurement_id=G-KP9BXCEF2Z&api_secret=<secret>`
with `purchase` + `transaction_id` = the Stripe session id or order set id.

`transaction_id` gives GA4 built-in deduplication, which is the second line of
defence behind the existing idempotency.

### Step 4 — Reconcile, do not trust

Because consent-gating means some purchases are necessarily unreportable, the
only defensible revenue number is the one in Stripe/Supabase. GA4 `purchase`
should be validated against it periodically, and the gap (unconsented buyers)
reported explicitly rather than hidden.

## 5. What is definitively established

Verified by reading code and querying the live GA4 property:

- GA4 property `343963754` has collected **zero `purchase` events in its entire
  history**. All-time event names are: `page_view`, `session_start`,
  `user_engagement`, `first_visit`, `scroll`, `form_start`, `click`,
  `form_submit`, `view_search_results`, `file_download`, `video_progress`,
  `video_start`.
- `checkout_completed` has therefore never produced a real conversion in GA4.
- The Medusa capture path in `marketplace-payment-webhook.ts` is a sound,
  already-locked hook point for an authoritative event.
- `fulfill_listing_checkout` returns `'applied'` exactly once per real payment,
  giving free idempotency for platform charges.
- No Measurement Protocol API secret exists in the repo or env (searched).

## 7. Decision taken (2026-11-13)

Confirmed with Peter: **zero marketplace purchases to date, one real credit-pack
purchase by a real maker, site not yet launched.**

Landed now (small, in `feat/ga4-conversion-tracking`):

- Added `platform_charge_returned` with `charge_kind` in
  `{credit_pack, plan, workshop_listing}`. Fired from the return landing
  (`/dashboard/instellingen` for credits/plan, `/dashboard/aanbod` for workshop
  listing). The charge kind is carried through the Stripe-return redirect as
  `?charge=`, allowlisted server-side before it reaches the client.
- Deliberately **not** named `purchase` and **no value/amount** parameter: the
  return landing knows which kind was bought, not what Stripe captured. Inventing
  an amount would corrupt revenue reporting.
- `checkout_completed` documented in `FUNNEL_EVENT_ORDER` as "reached the
  thank-you page", not a settled payment.

Deliberately deferred until there is real marketplace volume:

- Measurement Protocol server-side `purchase` (needs a GA4-UI API secret plus a
  consent-gated `_ga` client_id). Design is in §3–4 above.

This is instrumentation readiness for launch, not a revenue measurement claim.

## 6. Open questions — answered 2026-11-13

1. Marketplace checkout volume: **zero marketplace purchases ever**. Confirmed by
   Peter. GA4 agrees — `checkout_started` has never fired.
2. Attribution appetite: **not now**. One real credit-pack purchase exists, but
   building MP for that volume is not worth it before launch. Aggregate
   `platform_charge_returned` is enough to prove the payment flow works.
3. Measurement Protocol API secret: still unowned and **not needed yet** — it must
   be created in the GA4 UI when the MP work is picked up.

Recommendation: ship the Step 1 correction now (it is pure truth-telling and
unblocks clean funnel reporting), and only build Steps 2–3 once there is
confirmed marketplace volume worth attributing.
