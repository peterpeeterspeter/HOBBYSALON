# Tutorial Learning Loop and Community Proof Implementation Plan

> **For Hermes:** Execute this plan as small, reviewable slices. Start each behavior change with a failing pure test; do not write to production data while verifying.

**Goal:** Turn Hobbysalon tutorials and patterns into calm, printable learning pages for a 55+ audience: clear difficulty, graph-backed requirements, explicit next learning steps, opt-in PDF acquisition, and consented community project proof.

**Architecture:** Keep the article page server-first. Use `articles` for editorial attributes such as difficulty, `entity_links` and existing `learning_path_steps` for ordered learning relationships, and existing project/gallery storage only behind a new explicit article-showcase consent layer. Print and archive filtering are client-side presentation around server-provided article data. Newsletter delivery remains outside the storefront transaction path and is integrated through the existing `subscribers` model plus a provider adapter.

**Tech Stack:** Next.js App Router and Server Components, TypeScript, Supabase/Postgres, existing `entity_links`, `projects`, `project_gallery_images`, `subscribers`, Resend provider configuration, Tailwind/CSS variables, Node `--experimental-strip-types` tests.

---

## Current-state findings

| Feature | Existing foundation | Gap and integration decision |
|---|---|---|
| Print instructions | `artikel/[slug]/page.tsx` is a self-contained long-form page rendered from `body_markdown`. | Add an isolated client print button and a **scoped** print stylesheet. Hide global chrome, graph recommendations and interactive controls. Do not generate a separate PDF route for V1. |
| Difficulty | `Project` and `Workshop` already use `beginner`, `intermediate`, `advanced`; `Article` does not. | Add the same canonical field to `articles`. Reuse the existing vocabulary, labels and editor form pattern. No title/LLM-based inference. |
| Structured requirements | Article pages already resolve graph-linked products as `relatedProducts`; saved project runs already normalize graph products as materials. | Classify article-to-product links by explicit `relation_type`: `required_material` and `required_tool` are checklist requirements; current generic relations remain contextual suggestions. Never parse Markdown for shopping requirements. |
| Next steps | `entity_links` supports `related_article`; schema also has `learning_paths` and `learning_path_steps`. | Prefer authored learning-path order when the article participates in a path. Otherwise use only explicitly linked article edges, ranked by `sort_order`, then difficulty. Do not manufacture semantic recommendations. |
| Newsletter lead magnet | `subscribers` and segmentation fields exist in schema documentation, but storefront has no signup flow or delivery adapter. | Build a consent-aware lead-magnet subscription endpoint and provider adapter. Verify Resend audience/contact capabilities before selecting the exact API. Use double opt-in unless the selected provider legally guarantees an equivalent consent flow. |
| Community gallery | Personal `projects` already have owner-bound `project_gallery_images` uploads. | Add a dedicated consent/moderation junction. Never expose a personal project photo merely because it is graph-linked or belongs to a logged-in user. |

## Product decisions

1. **Difficulty is editorial truth, not a heuristic.** Values are `beginner`, `intermediate`, `advanced`; untagged legacy articles remain unbadged until reviewed. This avoids falsely reassuring a beginner.
2. **The badge uses text + color + icon.** Do not rely on green/yellow/red alone. Accessible labels are `Beginner`, `Gevorderd`, `Expert`; neutral icon treatment can preserve the requested visual signal without conveying status through color alone.
3. **Print belongs only on instructional content.** Show it for `tutorial`, `guide`, and `pattern`, not interview/inspiration pages. The output contains title, difficulty, author/date/read time, body, structured requirements and an optional personal notes area. It excludes image-heavy discovery cards, navigation, footer, favorite and purchase controls.
4. **“Benodigdheden” has two meanings and they must stay separate.**
   - `Vereist`: explicitly authored/graph-linked material or tool, shown in the printable checklist and project-run gating.
   - `Handig erbij`: existing generic graph product suggestions, never completion-gating and never printed as if mandatory.
5. **Learning sequence is authored.** “Volgende stappen” must not treat the nearest published dates or same-domain content as a learning path. Use ordered `learning_path_steps` first, then explicit `entity_links` of relation `related_article` / `next_step`.
6. **Community proof requires an explicit consent and moderation lifecycle.** Default is private. The user decides whether one selected project and selected photos may appear below the source article. A moderator must approve it before public rendering.
7. **Lead magnet must be an actual curated downloadable asset.** Do not promise a generic PDF for every tutorial. Start with a named, versioned asset such as `gratis-haakpatroon-startpakket-v1.pdf`, attached to a selected campaign or compatible article types/domains.

---

## Delivery order

### Slice A - Editorial learning metadata and archive filtering

### Task 1: Establish canonical difficulty primitives

**Objective:** Make article, workshop and project difficulty display consistently without duplicate label/color mappings.

**Files:**
- Create: `apps/storefront/src/lib/content/difficulty.ts`
- Create: `apps/storefront/src/lib/content/difficulty.test.ts`

**Step 1: Write failing tests**

Test all three canonical values, unknown/null behavior, Dutch label, order (`beginner < intermediate < advanced`) and accessible text. Example assertions:

```ts
assert.deepEqual(getDifficultyMeta("beginner"), {
  level: "beginner", label: "Beginner", order: 1,
});
assert.equal(getDifficultyMeta(null), null);
assert.equal(compareDifficulty("beginner", "advanced"), -1);
```

**Step 2: Run the test red**

```bash
cd apps/storefront
node --experimental-strip-types --test src/lib/content/difficulty.test.ts
```

**Step 3: Implement the minimal pure lookup**

Export the closed `DifficultyLevel` union, `getDifficultyMeta`, and `compareDifficulty`. Do not encode CSS classes in the data layer.

**Step 4: Run green**

Repeat the Node test and commit only this helper/test pair.

### Task 2: Add article difficulty safely

**Objective:** Add an editorial field without guessing values for legacy content.

**Files:**
- Create: `apps/storefront/scripts/migrate-article-learning-metadata.sql`
- Modify: `apps/storefront/src/types/platform.ts` (`Article`)
- Modify: `docs/schema.md` and `docs/SQL.md` (`articles` field documentation)

**Implementation:**

1. Inspect the live `articles` table/constraint before application. The repo’s established convention is a manually reviewed `apps/storefront/scripts/migrate-*.sql` migration, not an assumed Supabase migration directory.
2. Add nullable `difficulty_level text` with a check allowing `beginner`, `intermediate`, `advanced` or null.
3. Add an index only if archive filtering needs it after a query-plan check, e.g. partial index for `is_published = true` plus `difficulty_level`.
4. Do **not** backfill from article title/body/AI. Export a review CSV or admin query of legacy articles with `difficulty_level is null`.
5. Extend `Article` with `difficulty_level: DifficultyLevel | null` and update any generated/hand-maintained schema types as needed.

**Verification:** apply only against a disposable/local environment first; confirm null legacy rows still render; run TypeScript no-emit.

### Task 3: Introduce a reusable difficulty badge

**Objective:** Render an accessible, visually calm difficulty badge everywhere it is supported.

**Files:**
- Create: `apps/storefront/src/components/content/DifficultyBadge.tsx`
- Create: `apps/storefront/src/components/content/DifficultyBadge.test.tsx` or extend pure helper tests
- Modify: `apps/storefront/src/app/(public)/artikel/[slug]/page.tsx`
- Modify: `apps/storefront/src/components/cards/article-card.tsx`

**Implementation:**

- Render `DifficultyBadge` only for non-null metadata.
- Include a text label, icon and `aria-label`, e.g. `Moeilijkheid: Beginner`.
- Place it next to reading time on the detail page and in the metadata area on article cards.
- Keep touch/visual contrast appropriate for 55+ readers. The badge is not an action.

**Verification:** unit-test accessible label; inspect an article with and without difficulty; run targeted lint and TypeScript.

### Task 4: Add difficulty filter to article and pattern archives

**Objective:** Let visitors filter existing discovery hubs without changing slugs or search-param compatibility.

**Files:**
- Modify: `apps/storefront/src/lib/content/content-hub.ts`
- Modify: `apps/storefront/src/lib/content/content-hub.test.ts`
- Modify: `apps/storefront/src/components/content/ContentHubBrowser.tsx`
- Modify: `apps/storefront/src/app/(public)/artikelen/page.tsx`
- Modify: `apps/storefront/src/app/(public)/patronen/page.tsx`

**Implementation:**

1. Add optional `difficulty` filter state to the existing pure filter function.
2. Test a mixed list, no-difficulty articles, a selected difficulty and interaction with existing search/domain/type filters.
3. Add three large filter chips with visible labels. The “Geen keuze” state means all difficulties, including legacy untagged content.
4. Do not use a database filter until the current 48-item client-side hub cap is deliberately revisited. If volume grows, promote filter state to the existing query layer and retain the same UI contract.

**Verification:** Node test, browser check at mobile and desktop widths, screen-reader live result count.

---

## Slice B - Printable instructional page

### Task 5: Define printable content eligibility

**Objective:** Avoid showing a print control on non-instructional editorial pages.

**Files:**
- Create: `apps/storefront/src/lib/content/printable-article.ts`
- Create: `apps/storefront/src/lib/content/printable-article.test.ts`

**Tests:** `tutorial`, `guide`, `pattern` return true; `inspiration` and `interview` return false; unknown type returns false.

### Task 6: Add a client print trigger with no routing side effects

**Files:**
- Create: `apps/storefront/src/components/content/PrintArticleButton.tsx`
- Modify: `apps/storefront/src/app/(public)/artikel/[slug]/page.tsx`

**Implementation:**

- Isolate `window.print()` in a small `"use client"` component.
- Use a descriptive button label: `Print instructies`.
- Preserve keyboard focus and show no fake loading state.
- Render only when the pure eligibility helper returns true.
- Place next to favorite control in the meta bar, but ensure both controls remain comfortably tappable.

### Task 7: Add a scoped print stylesheet

**Files:**
- Modify: `apps/storefront/src/app/globals.css`
- Modify: `apps/storefront/src/app/(public)/artikel/[slug]/page.tsx`

**Implementation:**

- Wrap printable content in a stable `.print-article` container.
- In `@media print`: hide header/nav/footer, controls, breadcrumbs, graph recommendation sections, image hero overlays, page background decoration and non-essential images.
- Preserve `h1`, metadata, body, structured requirements and page-break-safe headings.
- Set readable black-on-white output, 12pt+ body text, generous line height and `@page` margins.
- Add an optional ruled “Mijn notities” block visible only in print.
- Never hide content using JS or generate a second page variant.

**Verification:** use browser print preview / generated PDF, confirm the main instructions fit without global navigation/footer and that page breaks do not split checklist rows.

---

## Slice C - Trustworthy structured requirements

### Task 8: Define article relationship semantics before UI

**Objective:** Make the graph’s material meaning explicit rather than treating all product links as requirements.

**Files:**
- Modify: `docs/schema.md` (`entity_links` relation types)
- Modify: `docs/SQL.md` relation-type comments only if needed
- Modify: graph authoring validation/scripting found under `apps/storefront/scripts/` and relevant creator/admin authoring form
- Create: `apps/storefront/src/lib/content/article-requirements.ts`
- Create: `apps/storefront/src/lib/content/article-requirements.test.ts`

**Canonical relation types:**

- `required_material`: required consumable/material
- `required_tool`: required reusable tool
- `optional_material`: useful but not required
- `related_product`: existing generic discovery relation, preserved as a suggestion only
- `related_workshop`, `related_event`, `related_article`, `next_step`: contextual graph relations

**Rules:** only `required_material` and `required_tool` appear in the standardized printable checklist. Preserve `sort_order`, then `weight`, and deduplicate by `entity_type:id`.

### Task 9: Extend the article page service with normalized sections

**Files:**
- Modify: `apps/storefront/src/lib/services/article-page.ts`
- Modify/Create: service-level test covering bidirectional edge handling, ordering, duplicate products, required vs optional grouping

**Implementation:**

- Keep current `relatedProducts` behavior for compatibility.
- Add `requiredMaterials`, `requiredTools`, `optionalProducts`, and `relatedArticles` to `ArticlePageData`.
- Fetch product target records once, then normalize based on connection relation type.
- Do not infer “tool” from a product title/category unless the relation type explicitly says `required_tool`.
- Retain Medusa price retrieval only for discovery/product cards; a requirement list does not require prices.

### Task 10: Render “Benodigdheden” as a structured section

**Files:**
- Create: `apps/storefront/src/components/content/ArticleRequirements.tsx`
- Modify: `apps/storefront/src/app/(public)/artikel/[slug]/page.tsx`
- Reuse: `apps/storefront/src/components/profile/StartSavedProjectButton.tsx` and graph project-run route where compatible

**UI behavior:**

- “Benodigdheden” appears above the body for tutorial/pattern content only when explicit requirements exist.
- Separate “Materialen” and “Gereedschap”; render plain checklist rows plus a canonical product detail link when available.
- Below it, optionally show “Handig erbij” using generic graph products. Label it as optional and keep it outside the print-required list.
- `Start dit project` remains the bridge to the existing personal confirmation flow. Do not add a parallel checklist persistence model to the article page.
- If no explicit requirements exist, do not fake a list. The existing graph discovery card section may still render lower on the page.

**Verification:** public page with 0, 1 and multiple requirements; start flow sees the same stable keys; repeat confirmation remains idempotent.

---

## Slice D - Authored “Volgende stappen” learning paths

### Task 11: Inspect and reuse existing learning paths

**Objective:** Avoid building a second learning-path model.

**Files:**
- Inspect: `learning_paths`, `learning_path_steps` schema and any dashboard/query implementation
- Create: `apps/storefront/src/lib/content/article-next-steps.ts`
- Create: `apps/storefront/src/lib/content/article-next-steps.test.ts`

**Ranking contract:**

1. If the source article belongs to an active `learning_path_steps` sequence, show up to the next three article steps after it.
2. Else use only explicitly linked articles via `next_step` then `related_article`, preserving `sort_order`, then `weight`.
3. Normalize duplicate IDs and exclude the source article.
4. Prefer non-decreasing difficulty among the authored candidates. If an editor explicitly orders a harder/easier item, preserve editorial order instead of reordering it silently.
5. Do not fall back to “same domain/recent posts.” Empty is preferable to a fabricated curriculum.

### Task 12: Add the next-step section on article detail pages

**Files:**
- Create: `apps/storefront/src/components/content/ArticleNextSteps.tsx`
- Modify: `apps/storefront/src/lib/services/article-page.ts`
- Modify: `apps/storefront/src/app/(public)/artikel/[slug]/page.tsx`

**UI:** three compact, image-led article cards below the body and above contextual commerce. Title: `Volgende stappen`. Use difficulty labels and reading time. Do not show the section when fewer than one trustworthy item exists.

**SEO:** normal internal anchors, no invented schema. Existing canonical URL and `BlogPosting` schema remain intact.

---

## Slice E - Lead magnet and measured email onboarding

### Task 13: Establish consent and delivery contracts before building UI

**Objective:** Select a legally and technically sound email flow.

**Files:**
- Create: `docs/newsletter-lead-magnet.md`
- Inspect: Resend configuration in `packages/modules/resend` and deployment env documentation
- Create: `apps/storefront/src/lib/newsletter/provider.ts`
- Create: `apps/storefront/src/lib/newsletter/provider.test.ts`

**Decisions that must be confirmed before implementation:**

- email provider and whether it owns a contact/audience API;
- double opt-in strategy and confirmation URL;
- unsubscribe and privacy copy owner;
- storage location/versioning for the actual lead-magnet PDF;
- whether the deliverable email is sent by Resend transactional email or a marketing automation provider.

**Provider boundary:** `subscribeLeadMagnet({ email, source, leadMagnetCode, preferredDomains })` returns a neutral outcome. It must not expose API keys to the browser. Upsert identities idempotently and retain source/consent metadata.

### Task 14: Create the lead-magnet campaign data and delivery lifecycle

**Files:**
- Create: `apps/storefront/scripts/migrate-newsletter-lead-magnets.sql`
- Modify: `docs/schema.md`
- Create: `apps/storefront/src/app/api/newsletter/lead-magnet/route.ts` or existing server action, based on form conventions
- Create: `apps/storefront/src/app/api/newsletter/confirm/route.ts` if double opt-in is platform-managed

**Suggested tables:**

- `newsletter_lead_magnets`: code, title, file_url, active, eligible article/domain constraints, created/updated timestamps.
- `newsletter_opt_in_events`: subscriber reference/email hash, lead magnet, source route, consent timestamp, status, confirmation token hash/expiry as needed.

Use server-side token hashing, rate limit form submission, and make confirmation/delivery idempotent. Never place the PDF URL in the client before consent confirmation.

### Task 15: Add hero and footer newsletter placements without duplicate data writes

**Files:**
- Create: `apps/storefront/src/components/newsletter/LeadMagnetSignup.tsx`
- Modify: selected eligible article/pattern templates and shared footer component
- Modify: `apps/storefront/src/app/globals.css` only for existing form tokens

**UX:** one concise contextual message at the article/pattern hero or after the first practical section, and one shared footer placement. Both submit the same component and source metadata. Clearly state what the reader gets, email frequency expectation, privacy link, confirmation state and accessible inline success/error state.

### Task 16: Configure the two-week sequence outside the request path

**Deliverables:**
- welcome/confirmation email;
- immediate lead-magnet delivery after confirmed consent;
- day 2: one practical starter lesson;
- day 5: graph-linked tutorial/workshop discovery;
- day 10: saved project invitation;
- day 14: preference centre / relevant domain selection.

Send only to confirmed subscribers. Use campaign tags and source metadata. Record event delivery failures without blocking storefront rendering. Add UTM parameters and consent-safe analytics.

---

## Slice F - “Gemaakt door onze community” with privacy and moderation

### Task 17: Add an explicit showcase-submission model

**Objective:** Reuse project/gallery images without making private projects public by accident.

**Files:**
- Create: `apps/storefront/scripts/migrate-article-community-showcase.sql`
- Modify: `docs/schema.md`
- Modify: `apps/storefront/src/types/platform.ts`
- Modify: `apps/storefront/src/lib/platform/queries/projects.ts`

**Suggested table:** `article_project_showcase_submissions`

- `id uuid pk`
- `article_id uuid not null references articles`
- `project_id uuid not null references projects`
- `submitted_by_user_id uuid not null`
- `status text not null default 'pending'` with `pending|approved|rejected|withdrawn`
- `approved_at`, `approved_by_user_id`, `moderation_note`
- `consent_text_version`, `consented_at`
- unique `(article_id, project_id)`

Do not make `projects.is_active` equivalent to public consent. Query only `approved` submissions and gallery images for public rendering. Ensure FK/RLS rules prove a user can submit/withdraw only their own project.

### Task 18: Build owner submission and withdrawal actions

**Files:**
- Modify: `apps/storefront/src/app/actions/profile-projects.ts`
- Modify: `apps/storefront/src/app/(public)/profile/projects/[id]/edit/page.tsx`
- Create: `apps/storefront/src/lib/profile/community-showcase.ts`
- Create: `apps/storefront/src/lib/profile/community-showcase.test.ts`

**Implementation:**

- Let an owner select an article source only from articles they explicitly started/saved, or from a trusted article selector associated with their project. Do not trust posted article IDs without an ownership/source check.
- Require selected gallery photos, a consent checkbox and visible explanation of where photos may appear.
- Submit once, withdraw at any time; both are idempotent.
- Keep status visible to the owner but not public until approved.

### Task 19: Add moderation surface and public gallery

**Files:**
- Create: `apps/storefront/src/app/(dashboard)/dashboard/community-submissions/page.tsx` (or existing internal admin surface after confirming auth role)
- Create: `apps/storefront/src/app/actions/community-showcase.ts`
- Create: `apps/storefront/src/components/content/CommunityProjectGallery.tsx`
- Modify: `apps/storefront/src/lib/services/article-page.ts`
- Modify: `apps/storefront/src/app/(public)/artikel/[slug]/page.tsx`

**UI:** below “Volgende stappen”, render `Gemaakt door onze community` only with approved submissions. Show selected project photo(s), project title and optional first name only if separately consented. Link to a public project only if its public visibility is explicit. No comments in V1.

**SEO:** community gallery is indexable only when photos are approved and public. Use accurate alt text supplied by the owner/moderator; do not generate or keyword-stuff alt text.

---

## Cross-cutting authoring and data quality

### Task 20: Add article editorial controls

Locate the actual article editor/import route before implementation. It was not found in the storefront scan and may be an external CMS/import pipeline. Extend that canonical authoring workflow with:

- difficulty selector;
- relation type selection for graph edges;
- requirement order;
- next-step/learning-path assignment;
- optional lead-magnet campaign selection.

Do not create a shadow article editor merely to support these features.

### Task 21: Curate in small batches

1. Start with 20 high-intent tutorial/pattern pages.
2. Editorially assign difficulties.
3. Add explicit material/tool edges and 1-3 next-step relations.
4. Add one real lead magnet to one priority pattern funnel.
5. Invite a small opt-in beta of existing project creators for showcase submissions.
6. Measure before scaling.

No broad automated tagging/linking based on titles, Markdown or AI semantic guesses.

---

## Acceptance criteria

- Tutorial/guide/pattern readers can print a calm, readable page with no navigation/footer/sidebar clutter.
- Difficulty badge is visible only when editorial data exists, is filterable, and is accessible without color dependence.
- “Benodigdheden” contains only explicit graph/authored requirements; optional commerce remains clearly labelled.
- “Volgende stappen” contains only authored learning-path or explicit graph links and preserves editorial order.
- Lead-magnet opt-in is consent-aware, rate-limited, idempotent and sends no PDF before confirmation.
- Community photos appear only after owner consent and moderator approval; withdrawal removes them from the public article promptly.
- No change breaks existing favorites, saved project runs, product/Medusa checkout truth, SEO slugs, or the existing article graph sections.

## Validation matrix

```bash
cd apps/storefront
node --experimental-strip-types --test \
  src/lib/content/difficulty.test.ts \
  src/lib/content/printable-article.test.ts \
  src/lib/content/article-requirements.test.ts \
  src/lib/content/article-next-steps.test.ts \
  src/lib/newsletter/provider.test.ts \
  src/lib/profile/community-showcase.test.ts

yarn lint <each changed source/test path>
./node_modules/.bin/tsc -p tsconfig.json --noEmit
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" yarn build
cd ../..
git diff --check
```

Manual browser checks:

1. Instructional article vs non-instructional article print button visibility.
2. Print preview, including a multi-page materials checklist.
3. Difficulty filter interaction plus no-difficulty legacy result.
4. Required versus optional graph product rendering and saved project start.
5. Ordered next steps with duplicate/empty/unknown difficulty fixtures.
6. Newsletter invalid email, duplicate email, confirmation, unsubscribe and delivery-failure paths.
7. Community submission ownership rejection, pending state, moderator approval, public rendering, withdrawal, and no-images empty state.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fake difficulty/requirements reduce trust | No automatic inference; nullable legacy difficulty; explicit relation types only. |
| Generic graph product links accidentally gate a project | Separate required relation types and stable-key tests. |
| Community photos leak private content | Explicit consent table, owner checks, moderator approval, RLS and withdrawal. |
| Newsletter regulatory/deliverability issue | Provider/consent decision before UI; double opt-in; unsubscribe; no secrets in frontend. |
| Sparse editorial graph leaves empty sections | Do not fabricate results; ship with curated 20-page cohort first. |
| Print CSS leaks into other routes | Scope styles to article print container and test print preview. |

## Recommended sequencing and effort

1. **Week 1:** Slice A + B. Immediate 55+ utility, low operational risk.
2. **Week 2:** Slice C + D. Deepens the already-built graph journey and increases session depth.
3. **Week 3:** Slice E. Depends on confirmed email/legal/provider contract and a real PDF asset.
4. **Week 4:** Slice F. Run a moderated beta before broad UGC exposure.

Commit each slice separately after its tests, TypeScript, build and runtime checks pass. Do not combine schema migrations, email provider activation and public UGC in one deployment.
