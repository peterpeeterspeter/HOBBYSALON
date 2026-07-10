# Content Graph Remaining Work Plan

> **For Hermes:** Execute this plan as a safe, incremental completion of the prior content-graph slice.

**Goal:** Let creators publish patterns through the existing article workflow and complete the pending, scoped graph linking without creating thousands of generic production edges.

**Current evidence:** The existing creator dashboard already has article link suggestions plus review/approval. The live graph has 695 published articles and 428 article edges. A dry-run for the imported-content creator produces 23 missing same-domain edges. A simulated all-author bulk run would create 2,011 generic edges across 549 articles, so it must not run without a later editorial relevance/ranking design.

**Architecture:** Reuse `articles.article_type = 'pattern'`; do not add a second CMS or tools table. Extract the allowed authoring article types into one dependency-free module that both dashboard actions and UI use. Fix the auto-link script to work with the repository's available Supabase URL naming while preserving its explicit scoped author mode.

---

### Task 1: Centralize allowed content types and enable patterns

**Files:**
- Create: `apps/storefront/src/lib/content/article-types.ts`
- Create: `apps/storefront/src/lib/content/article-types.test.ts`
- Modify: `apps/storefront/src/app/actions/dashboard.ts`
- Modify: `apps/storefront/src/components/dashboard/creator/types.ts`
- Modify: `apps/storefront/src/components/dashboard/creator/CreatorArticlesTab.tsx`

**Steps:**
1. Write a failing Node test that asserts `pattern` is an allowed authorable type and has Dutch label `Patroon`.
2. Create the dependency-free content-type module exporting the allowed values, options and guard.
3. Replace duplicated action/UI constants with the module.
4. Update dashboard copy so creators understand a pattern can link to materials, workshops, makers and events.
5. Run the focused test.

### Task 2: Make the scoped auto-link script use the available Supabase URL

**Files:**
- Create: `apps/storefront/src/lib/content/supabase-script-env.ts`
- Create: `apps/storefront/src/lib/content/supabase-script-env.test.ts`
- Modify: `apps/storefront/scripts/auto-link-articles.ts`

**Steps:**
1. Write a failing Node test that accepts `SUPABASE_URL` when `NEXT_PUBLIC_SUPABASE_URL` is absent and gives precedence to the public URL when both exist.
2. Implement the small resolver and use it from the script.
3. Run the script with `--dry-run` without injecting environment aliases; expected scope remains 140 articles and 23 links.

### Task 3: Apply only the dry-run-proven scoped links

**External side effect:** Insert 23 missing `article → product/workshop/event` edges for the existing imported-content creator only.

**Steps:**
1. Run the script in its existing explicit default-author scope, without `--all-authors` behavior.
2. Query the graph afterward by counts only.
3. Confirm 23 new edges appeared and that no duplicate target pairs were introduced.

### Task 4: Validate, commit and push

**Commands:**
```bash
node --experimental-strip-types --test src/lib/content/article-types.test.ts src/lib/content/supabase-script-env.test.ts
node --experimental-strip-types scripts/auto-link-articles.ts --dry-run
yarn --cwd apps/storefront lint src/lib/content/article-types.ts src/lib/content/article-types.test.ts src/lib/content/supabase-script-env.ts src/lib/content/supabase-script-env.test.ts scripts/auto-link-articles.ts src/app/actions/dashboard.ts src/components/dashboard/creator/types.ts src/components/dashboard/creator/CreatorArticlesTab.tsx
./node_modules/.bin/tsc -p apps/storefront/tsconfig.json --noEmit
yarn --cwd apps/storefront build
git diff --check
git add ... && git commit -m "feat: enable pattern graph authoring"
git push
```

**Explicitly deferred:** Tool nodes require IDs in the graph table (which currently uses UUID target IDs) and should be designed with a proper `tools` table/migration. The 2,011-link all-author simulation is also deferred until relevance controls, editorial sampling, and an approval queue exist.
