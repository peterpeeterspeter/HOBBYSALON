# Content Graph Navigation Implementation Plan

> **For Hermes:** Execute the plan as a scoped vertical slice. Do not introduce a CMS, migration, or bulk data rewrite in this change.

**Goal:** Make articles, patterns and tools discoverable from the desktop navigation, add global content hubs, and make article/pattern pages consume the graph in both directions so content can lead visitors to materials, workshops, makers and events.

**Architecture:** Keep articles and patterns in the existing `articles` table. Add focused list queries for global hubs. Add a pure graph-connection normalizer plus a Supabase query that reads both incoming and outgoing `entity_links`; consume it from the article-page service. Explicit editorial relationships remain authoritative, while the article author is surfaced as the relevant maker fallback.

**Tech Stack:** Next.js App Router, TypeScript, Supabase PostgREST, Tailwind, Node native test runner.

---

### Task 1: Add testable bidirectional graph normalization

**Objective:** Normalize an edge relative to the viewed entity so source and target are both usable as a contextual relation.

**Files:**
- Create: `apps/storefront/src/lib/platform/entity-graph.ts`
- Create: `apps/storefront/src/lib/platform/entity-graph.test.ts`

**Steps:**
1. Add a failing Node test proving an outbound `article -> product` edge resolves to a product and an inbound `workshop -> article` edge resolves to a workshop.
2. Run `node --experimental-strip-types --test src/lib/platform/entity-graph.test.ts` and confirm it fails because the module is absent.
3. Implement the smallest normalizer and rerun the test.

### Task 2: Read graph connections in both directions

**Objective:** Make the platform query layer fetch inbound and outbound edges without mirrored database records.

**Files:**
- Modify: `apps/storefront/src/lib/platform/queries/entity-links.ts`

**Steps:**
1. Import the pure normalizer.
2. Add `getEntityConnections(entityType, entityId)`, querying `entity_links` as both source and target.
3. Preserve `sort_order` first and `weight` second in ranking; retain the existing outbound-only query for callers that need it.
4. Run the graph unit test again.

### Task 3: Make article and pattern pages use the graph

**Objective:** Every article and pattern page can render linked products, workshops, creators and events regardless of edge direction, and always exposes its author as a maker.

**Files:**
- Modify: `apps/storefront/src/lib/services/article-page.ts`

**Steps:**
1. Replace direct outbound-only reads with `getEntityConnections`.
2. Resolve related IDs from normalized connections.
3. Deduplicate explicit creators with the article author and retain existing active/published guards.
4. Verify TypeScript and production build.

### Task 4: Add global hubs for articles and patterns

**Objective:** Provide stable, indexable content hubs rather than using Crochet as the global articles route or free crochet as the generic patterns route.

**Files:**
- Modify: `apps/storefront/src/lib/platform/queries/articles.ts`
- Create: `apps/storefront/src/app/(public)/artikelen/page.tsx`
- Create: `apps/storefront/src/app/(public)/patronen/page.tsx`

**Steps:**
1. Add bounded published-content queries: one excluding `pattern`, one filtering to `pattern`.
2. Build concise server-rendered hubs with metadata, explanatory copy, empty states, and existing `ArticleCard`/`GridLayout` components.
3. Keep `/gratis-haakpatronen` as a focused SEO collection.
4. Verify the new routes in `next build`.

### Task 5: Surface content in desktop navigation

**Objective:** Add a clear desktop “Ontdekken” menu containing Artikelen, Patronen and Tools without overcrowding the main navigation.

**Files:**
- Modify: `apps/storefront/src/config/nav.ts`
- Modify: `apps/storefront/src/components/shared/Header.tsx`

**Steps:**
1. Point the article and pattern config to global hubs.
2. Render a keyboard-native `<details>` content menu on desktop; retain the existing grouped mobile menu.
3. Keep the navigation single-line by showing the desktop menu only from `xl` and using the existing mobile menu below that breakpoint.
4. Ensure all links use visible Dutch labels and existing focus styling.

### Task 6: Validate and report graph readiness

**Objective:** Verify the implementation and quantify remaining editorial/data work.

**Commands:**
```bash
node --experimental-strip-types --test src/lib/platform/entity-graph.test.ts
yarn --cwd apps/storefront lint src/lib/platform/entity-graph.ts src/lib/platform/entity-graph.test.ts src/lib/platform/queries/entity-links.ts src/lib/services/article-page.ts 'src/app/(public)/artikelen/page.tsx' 'src/app/(public)/patronen/page.tsx' src/components/shared/Header.tsx src/config/nav.ts
./node_modules/.bin/tsc -p apps/storefront/tsconfig.json --noEmit
yarn --cwd apps/storefront build
git diff --check
```

**Risks / follow-up:**
- Existing graph data has no article-to-creator or article-to-article edges, so the author fallback covers makers but editorial linking needs a dashboard workflow next.
- Tools remain registry-based. A future migration can introduce a `tool` graph entity and editor UI; it is intentionally not bundled into this navigation and retrieval slice.
- Existing `auto-link:articles` must be inspected and dry-run before any bulk mutation of production links.
