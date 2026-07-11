# Hobbysalon Taste-Skill V2 Page Redesign Plan

> **For Hermes:** Execute this as a redesign-preserve program. Keep URLs, form field names, existing search parameters, SEO metadata, analytics events and graph semantics intact.

**Goal:** Bring every remaining public Hobbysalon experience to the same clear, image-led, senior-friendly standard as the refreshed content hubs and project journey, prioritising discovery-to-booking and discovery-to-purchase conversion.

**Design read:** Connected creative marketplace for a broad, predominantly 55+ audience. Preserve the warm Hobbysalon system, use real craft photography, large type, explicit next steps and graph-led recommendations.

**Taste settings:** `DESIGN_VARIANCE: 3`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 5`.

**Design rules:**
- Retain the existing warm brand tokens in `src/app/globals.css`; do not introduce a second palette or design system.
- Use the existing Quicksand/Lato typography, `CardShell`, `Container`, `Section`, cards and 48px touch target baseline.
- Use only purposeful hover/active feedback. No auto-motion, carousel, visual gimmicks, faux dashboards or generic gradients.
- Lead each public page with one task-oriented message, one primary CTA and at most one secondary CTA.
- Keep graph value practical and human: materials, workshops, makers and events. Never show the term "graph" as a user-facing feature label.
- Preserve server-side filtering and query-string links. Do not move catalog datasets into a client-only filter implementation.

---

## Current baseline

### Recently refreshed: protect, validate and reuse

| Route group | Existing direction | Action in this program |
|---|---|---|
| `/` | Image-led homepage with stronger hero and platform pillars | Light QA only. Reuse its photography rhythm and conversion language. |
| `/artikelen`, `/patronen` | Featured image, category/search filters and improved editorial hierarchy | Light QA only. Reuse `ContentHubBrowser` patterns where applicable. |
| `/profile`, `/favorites`, `/profile/start/*` | Saved ideas and graph-led project journey | Light QA only. Reuse the requirements/checklist visual pattern on related detail pages. |

### Highest-priority pages still using older catalog/detail compositions

| Priority | Route group | Why it matters | Intended outcome |
|---|---|---|---|
| P0 | `/materials`, `/product/[slug]` | Closest purchase path; current list has functional filters but weak merchandising and graph story | Find a material, understand why it fits, add it to cart or start its related project. |
| P0 | `/workshops`, `/workshop/[slug]` | Highest trust and booking path; functional sidebars feel like admin controls | Quickly select a relevant workshop, understand practical details and book confidently. |
| P0 | `/agenda`, `/agenda/[slug]`, `/event/[slug]` | Local discovery needs date/location emphasis and conversion clarity | Find a nearby creative day out, save it or get tickets. |
| P0 | `/artikel/[slug]`, `/project/[slug]` | Key bridge between inspiration, requirements and commerce | Start a project, see requirements and discover connected workshops/events. |
| P1 | `/creators`, `/creator/[slug]` | Maker trust and follow/discover flow is core marketplace differentiation | Meet a maker, see their work and choose a next action. |
| P1 | `/tools`, `/tools/[slug]` | Current static tools experience is disconnected from project discovery | Make tools useful as a practical companion, while keeping graph limitations honest. |
| P1 | `[domain]/*` hubs | Valuable SEO landing pages that must route visitors into discovery journeys | Each domain becomes a strong themed landing page with relevant local paths. |
| P2 | `/zoeken`, `/gratis-haakpatronen` | Search and legacy SEO collection need consistency after hub redesign | Better scanability without changing SEO intent. |
| P2 | `/landing`, `/partners`, `/voor-makers`, `/voor-workshopgevers`, `/voor-winkels`, `/voor-organisatoren` | Acquisition paths have different audiences and CTA needs | Conversion-led partner pages, not generic feature pages. |
| P2 | `/login`, `/register/*`, `/auth/confirm`, `/cart`, `/checkout`, `/checkout/success` | Conversion-critical but visual changes must avoid form and payment regressions | Reduce anxiety, clarify next action and preserve all existing auth/checkout mechanics. |
| Separate scope | `/dashboard/**`, `/profile/projects/new`, `/profile/projects/[id]/edit` | Product/dashboard surfaces are multi-step forms and should not use the marketing-page Taste pattern wholesale | Run a dedicated usability pass using form and workflow heuristics after public routes. |

---

## Shared foundation before page work

### Task 1: Establish a reusable public discovery shell

**Objective:** Remove repeated ad-hoc catalog headers while retaining existing server filtering and query parameters.

**Files to inspect/modify:**
- `apps/storefront/src/components/layout/page-layout.tsx`
- `apps/storefront/src/components/ui/section-header.tsx`
- `apps/storefront/src/components/materials/CategoryCircles.tsx`
- `apps/storefront/src/components/materials/ActiveFilterChips.tsx`
- Create: `apps/storefront/src/components/discovery/DiscoveryHero.tsx`
- Create: `apps/storefront/src/components/discovery/DiscoveryFilterSummary.tsx`

**Implementation:**
1. Write a visual/component contract for a left-aligned discovery hero: title, short description, count/location context and up to two actions.
2. Keep filters as URL links/forms and move only the shared visual framing into reusable components.
3. Include composed loading, empty and reset states.
4. Use a consistent mobile pattern: filter trigger precedes the results grid and active chips remain visible.

**Validation:** keyboard navigation, 48px controls, long Dutch labels at 320px, no URL/query-string regression.

### Task 2: Create graph recommendation presentation primitives

**Objective:** Present linked materials, workshops, makers and events consistently, without duplicating query logic.

**Files to inspect/modify:**
- `apps/storefront/src/lib/platform/queries/entity-links.ts`
- `apps/storefront/src/lib/services/article-page.ts`
- `apps/storefront/src/components/cards/*`
- Create: `apps/storefront/src/components/graph/ConnectedNextSteps.tsx`
- Create: `apps/storefront/src/components/graph/RequirementsPreview.tsx`

**Implementation:**
1. Accept pre-resolved entities from existing server services; do not query Supabase from card components.
2. Use clear labels by intent: "Dit heb je nodig", "Leer dit in een workshop", "Van deze maker", "Ontdek het in het echt".
3. Provide an empty-state rule: omit a section when there is no credible graph data, never fill it with unrelated fallback recommendations.
4. Reuse the saved-project confirmation pattern only on authenticated personal flows.

**Validation:** inbound and outbound links preserve `sort_order` then `weight`; no duplicate entity cards; all destination links resolve.

---

## Phase 1: Commerce and bookings

### Task 3: Redesign material discovery

**Routes:** `/materials`, `[domain]/supplies`, `[domain]/handmade`

**Files:**
- `apps/storefront/src/app/(public)/materials/page.tsx`
- `apps/storefront/src/app/(public)/[domain]/supplies/page.tsx`
- `apps/storefront/src/app/(public)/[domain]/handmade/page.tsx`
- Existing materials components under `src/components/materials/`

**Design direction:** Turn the dense marketplace layout into a guided materials finder.

**Changes:**
1. Add `DiscoveryHero` with prominent search, a useful category starter row and an explicit local-maker/value message.
2. Recompose sidebar/filter controls as a calm desktop rail plus mobile disclosure, without changing URL state.
3. Place one relevant graph section after the results header only when a selected domain has trustworthy links.
4. Upgrade product rows/cards to make image, title, price, seller confidence and delivery/availability easier to scan.
5. Preserve grid/list preference, pagination, category filters and Medusa price enrichment.

**Acceptance criteria:** The user can search, select a category, recognise a product image/price and reach product detail in two clear interactions.

### Task 4: Redesign product detail for confident buying

**Route:** `/product/[slug]`

**Files:**
- `apps/storefront/src/app/(public)/product/[slug]/page.tsx`
- Existing product detail/cart components and commerce queries

**Changes:**
1. Build a split product header: real image gallery/primary image, short title and purchase module above the fold on desktop; single-column image-first order on mobile.
2. Reorder content into "Waarom dit past", practical product details, maker/seller confidence and connected next steps.
3. Show graph-linked project/article/workshop context only where exact relationships exist.
4. Keep Medusa variant selection, stock state, cart actions and analytics event names untouched.

**Acceptance criteria:** Add-to-cart CTA is visible, labels are unambiguous, variants are usable at large text sizes and graph suggestions have a clear purpose.

### Task 5: Redesign workshop discovery and detail

**Routes:** `/workshops`, `[domain]/workshops`, `/workshop/[slug]`

**Files:**
- `apps/storefront/src/app/(public)/workshops/page.tsx`
- `apps/storefront/src/app/(public)/[domain]/workshops/page.tsx`
- `apps/storefront/src/app/(public)/workshop/[slug]/page.tsx`
- `src/components/workshops/*`

**Changes:**
1. Replace the catalog-header/sidebar feel with a discovery hero, category entry points and a location-aware results header.
2. Make time, difficulty, price, location and booking mode consistently visible on cards.
3. On detail, use a booking-first information order: image, title, date/session, cost, location, instructor, booking CTA, then fuller description.
4. Add graph-linked materials as a "Goed voorbereid" section and articles/patterns as "Bekijk vooraf", only if linked.

**Acceptance criteria:** A beginner can identify whether a workshop suits them and reach booking without reading the whole page.

### Task 6: Redesign agenda and event detail

**Routes:** `/agenda`, `/agenda/[slug]`, `/event/[slug]`

**Files:**
- `apps/storefront/src/app/(public)/agenda/page.tsx`
- `apps/storefront/src/app/(public)/agenda/[slug]/page.tsx`
- `apps/storefront/src/app/(public)/event/[slug]/page.tsx`
- `src/components/events/*`

**Changes:**
1. Make date and locality the primary browsing controls; use an accessible date/range control that keeps the current query-string contract.
2. Use event cards with a consistent date treatment, image, distance/locality context and event type.
3. Detail page starts with date, venue, ticket/visit CTA and map/location context before descriptive content.
4. Present graph-linked makers, workshops and related material as optional preparation or discovery paths.

**Acceptance criteria:** Visitors can find what is happening near them and understand date, place and ticket action at a glance.

---

## Phase 2: Inspiration to project conversion

### Task 7: Redesign article and pattern detail pages

**Routes:** `/artikel/[slug]`, `/gratis-haakpatronen`, `[domain]/artikels`

**Files:**
- `apps/storefront/src/app/(public)/artikel/[slug]/page.tsx`
- `apps/storefront/src/app/(public)/gratis-haakpatronen/page.tsx`
- `apps/storefront/src/app/(public)/[domain]/artikels/page.tsx`
- `apps/storefront/src/lib/services/article-page.ts`

**Changes:**
1. Article header: type, image, concise promise, author/maker and a primary save/start-project action.
2. Place `RequirementsPreview` before long body content where materials are graph-linked.
3. Give patterns a practical first screen: difficulty where known, what is needed, time estimate only when actual data exists, start-project CTA.
4. Retain the current content body, structured data, metadata and existing `/gratis-haakpatronen` SEO intent.

**Acceptance criteria:** An article or pattern clearly leads to save, start, material discovery or learning in a workshop.

### Task 8: Redesign public project detail

**Route:** `/project/[slug]`

**Files:**
- `apps/storefront/src/app/(public)/project/[slug]/page.tsx`
- Related project queries/components

**Changes:**
1. Distinguish public inspiration from the authenticated personal project journey.
2. Add one primary action: save/start when logged in, sign in to save when anonymous.
3. Show authored steps and explicit material links in a calm requirements overview.
4. Include connected workshops/events in optional discovery blocks.

**Acceptance criteria:** No confusion between publishing a project and starting it personally.

### Task 9: Redesign tools as practical guides

**Routes:** `/tools`, `/tools/[slug]`

**Files:**
- `apps/storefront/src/app/(public)/tools/page.tsx`
- `apps/storefront/src/app/(public)/tools/[slug]/page.tsx`

**Changes:**
1. Make tools browseable by practical task and hobby type, with image-led featured guides.
2. On detail, use a compact answer-first layout with related articles/patterns where data supports it.
3. Do not claim graph-powered tool suggestions until tools exist as first-class graph entities.

**Acceptance criteria:** Tools remain useful without fabricated product or material relationships.

---

## Phase 3: Makers, domain SEO and acquisition

### Task 10: Redesign maker discovery and profiles

**Routes:** `/creators`, `/creator/[slug]`

**Files:**
- `apps/storefront/src/app/(public)/creators/page.tsx`
- `apps/storefront/src/app/(public)/creator/[slug]/page.tsx`
- Creator cards/profile components

**Changes:**
1. Use image/avatar-rich maker cards with primary craft, locality and one confident next action.
2. Profile page starts with work, workshop and shop signals before biography.
3. Organise outputs under work to buy, workshops to join, and inspiration from the maker.
4. Use graph-linked content only as a curated "Maak verder met" sequence.

### Task 11: Turn domain routes into focused hobby landing pages

**Routes:** `[domain]`, `[domain]/workshops`, `[domain]/supplies`, `[domain]/handmade`, `[domain]/learning-paths`, `[domain]/learning-paths/[pathSlug]`, `[domain]/artikels`

**Files:**
- Corresponding files under `src/app/(public)/[domain]/`
- Domain query/service files

**Changes:**
1. Standardise a domain hero with real domain visual, clear hobby promise and a single next action.
2. Assemble domain-specific sections from existing data: workshops, materials, creators, articles/patterns and events.
3. Use a different layout rhythm for each page type, not the same generic card grid repeatedly.
4. Preserve every dynamic slug, canonical metadata and server-side data requirement.

**Acceptance criteria:** Each domain page works as a standalone search landing page and routes visitors toward a concrete next step.

### Task 12: Redesign participation and partner pages

**Routes:** `/voor-makers`, `/voor-workshopgevers`, `/voor-winkels`, `/voor-organisatoren`, `/partners`, `/landing`

**Files:**
- Corresponding pages under `src/app/(public)/`

**Changes:**
1. Separate the audience proposition from consumer marketplace messaging.
2. Use one real workflow story per page with relevant images, proof and one primary CTA.
3. Keep current price/plan and registration copy accurate. Do not invent growth claims, customer counts or revenue statistics.
4. Reuse the marketplace design language without adding a B2B SaaS visual system.

---

## Phase 4: Transaction and account confidence pass

### Task 13: Improve search and legacy collections

**Routes:** `/zoeken`, `/gratis-haakpatronen`

**Files:**
- `apps/storefront/src/app/(public)/zoeken/page.tsx`
- `apps/storefront/src/app/(public)/gratis-haakpatronen/page.tsx`

**Changes:** Align result headings, filters, empty states and images with new discovery hubs. Preserve search contract and SEO collection intent.

### Task 14: Improve auth and commerce confidence surfaces

**Routes:** `/login`, `/register`, `/register/creator`, `/register/merchant`, `/auth/confirm`, `/cart`, `/checkout`, `/checkout/success`

**Files:**
- Corresponding routes under `src/app/(public)/`
- Existing auth/cart/checkout components

**Changes:**
1. Keep form labels, fields, redirects and Supabase confirmation mechanics unchanged.
2. Improve hierarchy, reassurance and inline error/empty states.
3. In checkout, prioritise order summary, delivery/payment clarity and a single purchase action.
4. In success, provide clear order next steps and one optional discovery continuation.

**Risk:** Payment and auth routes require manual regression tests. Do not bundle them with broad visual changes.

### Task 15: Dedicated dashboard usability audit

**Routes:** `/dashboard/**`, `/profile/projects/new`, `/profile/projects/[id]/edit`

**Approach:** This is a separate workflow/form UX project, not a Taste-marketing redesign. Audit task completion, form labels, draft/save states, error handling, mobile operation and creator handoff to the vendor portal.

---

## Verification standard for every phase

1. Before editing, capture desktop and mobile screenshots of target routes and note the preserved SEO/interaction contract.
2. Use TDD for extracted pure helpers and behavior changes; visual-only composition changes require route-level runtime checks.
3. Run targeted ESLint, TypeScript and production build after each coherent slice.
4. Check `git diff --check`, empty states, keyboard traversal, focus contrast, 48px targets, image fallbacks and responsive navigation.
5. Test public routes with live-compatible Supabase URL configuration. For authenticated routes, test redirect behavior without exposing credentials.
6. Do not commit/push unrelated redesign phases together. One commit per coherent route family.

## Recommended delivery order

1. Shared discovery/graph primitives.
2. Materials + product detail.
3. Workshops + workshop detail.
4. Agenda + event detail.
5. Article/pattern/project detail journey.
6. Makers + domains.
7. Acquisition pages.
8. Search, account, cart and checkout confidence pass.
9. Separate dashboard usability program.

## Risks and decisions to preserve

- Product price and stock remain Mercur/Medusa transactional data.
- Platform discovery remains Supabase-first.
- Graph sections only surface existing, credible links. Never auto-fill them with generic items.
- Tools cannot yet be treated as graph requirement nodes without a data-model decision.
- Existing legacy SEO pages and dynamic domain routes need canonical/structured-data checks before visual replacement.
