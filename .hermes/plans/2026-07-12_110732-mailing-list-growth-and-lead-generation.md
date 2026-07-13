# Hobbysalon Mailing List Growth and On-site Lead Generation Plan

> **For Hermes:** Use test-driven-development for code slices. Never subscribe a visitor without clear consent; treat Acumbamail as downstream after Hobbysalon confirmation.

**Goal:** Grow a permission-based mailing list using high-intent on-site placements, useful lead magnets, and measurable integrations without disrupting the calm 55+ experience.

**Architecture:** Hobbysalon is consent source of truth: `subscribers` plus `newsletter_opt_in_events` record signup and campaign consent. A campaign-specific form creates a pending event; `/nieuwsbrief/bevestigen` confirms it, sends the gated asset, then synchronizes to Acumbamail through `ACUMBAMAIL_WEBHOOK_URL`. Generic newsletter forms remain useful for inspiration-only subscription.

**Tech Stack:** Next.js App Router, existing `NewsletterSignupForm`, Supabase platform tables, Acumbamail incoming webhook, existing analytics `trackEvent`.

---

## Funnel and placement strategy

| Priority | Placement | Offer | Audience | Measurement |
|---|---|---|---|---|
| P0 | Footer | Weekly calm creative inspiration | Every public page | `newsletter_signup` by `footer_form` |
| P0 | Landing CTA | “Ontvang rustige creatieve inspiratie” | New visitors | landing form conversion |
| P0 | Tutorial/pattern below introduction | Relevant free pattern/checklist campaign | High-intent readers | `lead_magnet_form`, confirmation, delivery |
| P1 | `/gratis-haakpatronen` hero | Named free starter PDF | Crochet discovery traffic | code-specific confirmation rate |
| P1 | Saved project / requirements state | Printable materials checklist | Logged-in makers | project-to-signup rate |
| P2 | Workshop/event completion | Local agenda digest | Event/workshop users | interest segment + city |

## Lead-magnet rules

1. Start with one genuine, named asset: `gratis-haakpatroon-startpakket-v1.pdf`.
2. Seed an active `newsletter_lead_magnets` record manually with a non-public/gated file URL and code `haak-startpakket-v1`.
3. Campaign forms always use the existing Hobbysalon confirmation route; Acumbamail receives the subscriber only after confirmation with `double_optin: 0`, `welcome_email: 0`, `update_subscriber: 1`.
4. Never use a pre-checked consent box, countdown, or forced modal. Copy must say what arrives and that unsubscribe is available.

## Execution tasks

### Task 1: Add the P0 landing lead form

**Files:**
- Modify: `apps/storefront/src/app/(public)/landing/page.tsx`
- Reuse: `apps/storefront/src/components/shared/NewsletterSignupForm.tsx`

1. Place an accessible form section above the current final CTA, not in the image hero.
2. Use the existing default form (no fake PDF promise) with a Dutch benefit-led heading and clear privacy/unsubscribe copy.
3. Preserve current landing CTAs, metadata, and image hierarchy.
4. Verify mobile layout and keyboard focus.

### Task 2: Activate the first campaign only after asset configuration

**Files:**
- Modify: `apps/storefront/src/app/(public)/gratis-haakpatronen/page.tsx` after inspection
- Reuse: `NewsletterSignupForm` with `leadMagnetCode="haak-startpakket-v1"` and source path.

1. Verify the database row and PDF asset first.
2. Add campaign form below the hero, with exact asset title and no generic “gratis PDF” claim.
3. Test pending event, confirmation link, Acumbamail sync and delivery on a non-production test address.

### Task 3: Create a reusable contextual lead block

**Files:**
- Create: `apps/storefront/src/components/content/LeadMagnetCallout.tsx`
- Create: test/helper only if selection logic is pure.
- Modify: article/pattern detail pages only after there is a source-appropriate campaign mapping.

1. Render only with explicit campaign metadata; never infer an offer from article prose.
2. Keep it below the article introduction or after a completed tutorial, never before instructional content.
3. Log campaign code and source path through the existing form.

### Task 4: Close the reporting loop

**Files:**
- Modify only after existing analytics schema inspection.

Track and report weekly:
- form impressions;
- signup submit success;
- confirmation success;
- delivery success;
- Acumbamail sync result (server logs/metric only, no email addresses);
- unsubscribe rate and source campaign.

## Required configuration before campaign activation

```text
ACUMBAMAIL_WEBHOOK_URL=<fresh private incoming webhook URL>
RESEND_API_KEY=<server-only>
RESEND_FROM_EMAIL=<verified sender>
NEXT_PUBLIC_SITE_URL=https://www.hobbysalon.be
NEWSLETTER_CONFIRMATION_SECRET=<long random secret>
```

## Validation

```bash
cd apps/storefront
node --experimental-strip-types --test src/lib/newsletter/*.test.ts
yarn lint
./node_modules/.bin/tsc -p tsconfig.json --noEmit
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" yarn build
git diff --check
```

Runtime checks: landing form keyboard/mobile flow; one generic signup; one campaign signup after configuration; confirmation exactly once; Acumbamail row update; PDF delivery after confirmation only.
