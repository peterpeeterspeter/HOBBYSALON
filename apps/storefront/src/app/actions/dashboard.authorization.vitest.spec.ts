import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Query = { table: string; operation: string; filters: Array<[string, unknown]> };

const h = vi.hoisted(() => ({
  user: { id: "user-owner" } as { id: string } | null,
  creator: { id: "creator-owner", slug: "maker" } as { id: string; slug: string } | null,
  rows: {} as Record<string, Row[]>,
  queries: [] as Query[],
  timeline: [] as string[],
  failure: null as { table: string; operation: string; withData?: boolean; throws?: boolean } | null,
  zeroArticleUpdate: false,
  from: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw Object.assign(new Error(url), { digest: "NEXT_REDIRECT;replace;" + url });
  },
}));
vi.mock("@/lib/platform/client", () => ({ createPlatformClient: () => ({ from: h.from, rpc: h.rpc }) }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: async () => h.user }));
vi.mock("@/lib/platform/queries/creators", () => ({
  getCreatorByUserId: async () => h.creator,
  getCreatorById: vi.fn(),
}));
vi.mock("@/lib/storage/upload-image", () => ({
  requireUploadedImageUrl: h.upload,
  resolveProductImageUrl: vi.fn(),
}));
// Keep unrelated commerce and service dependencies out of this local action test.
vi.mock("@/lib/platform/queries/community-showcase", () => ({ isModerator: vi.fn() }));
vi.mock("@/lib/commerce/medusa/creator-orders", () => ({ cancelCreatorOrder: vi.fn(), completeCreatorOrder: vi.fn() }));
vi.mock("@/lib/commerce/medusa/creator-products", () => ({ deleteCreatorMarketplaceProduct: vi.fn(), updateCreatorMarketplaceProduct: vi.fn() }));
vi.mock("@/lib/commerce/medusa/creator-onboarding", () => ({ ensureCreatorSellerLinked: vi.fn() }));
vi.mock("@/lib/platform/commercial-enforcement", () => ({}));
vi.mock("@/lib/platform/workshop-listing-fee", () => ({}));
vi.mock("@/lib/platform/listing-credits", () => ({}));
vi.mock("@/lib/platform/queries/role-requests", () => ({}));
vi.mock("@/lib/platform/queries/user-registration", () => ({}));
vi.mock("@/lib/platform/queries/workshop-categories", () => ({}));
vi.mock("@/lib/platform/queries/projects", () => ({
  insertProjectSoughtMaterial: async (projectId: string, title: string, options: Row) => {
    const { data, error } = await h.from("project_sought_materials")
      .insert({ project_id: projectId, title, ...options }).select("id").single();
    return error ? null : data;
  },
  deleteProjectSoughtMaterial: async (id: string) => {
    const { error } = await h.from("project_sought_materials").delete().eq("id", id);
    return !error;
  },
}));

import {
  createCreatorEntityLinkAction,
  createProjectGalleryImageAction,
  deleteProjectGalleryImageAction,
  createProjectProductLinkAction,
  deleteProjectProductLinkAction,
  createProjectSoughtMaterialAction,
  deleteProjectSoughtMaterialAction,
  updateArticleAction,
} from "./dashboard";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "22222222-2222-4222-8222-222222222222";
const CHILD = "33333333-3333-4333-8333-333333333333";
const ARTICLE = "44444444-4444-4444-8444-444444444444";
const DOMAIN = "55555555-5555-4555-8555-555555555555";

/** Minimal Supabase boundary: filters affect actual fixture rows and writes.
 * Unselected mutations intentionally return null data, like PostgREST.
 */
function query(table: string) {
  let operation = "select";
  let columns = "*";
  let selected = false;
  let single = false;
  let head = false;
  let max = Infinity;
  let offset = 0;
  let payload: Row | Row[] = {};
  const filters: Array<[string, unknown]> = [];
  const predicates: Array<(row: Row) => boolean> = [];
  const builder = {
    select(value: string, options?: { head?: boolean }) { columns = value; selected = true; head = !!options?.head; return builder; },
    eq(key: string, value: unknown) { filters.push([key, value]); predicates.push(row => row[key] === value); return builder; },
    neq(key: string, value: unknown) { predicates.push(row => row[key] !== value); return builder; },
    in(key: string, values: unknown[]) { predicates.push(row => values.includes(row[key])); return builder; },
    limit(value: number) { max = value; return builder; },
    order() { return builder; },
    range(start: number, end: number) { offset = start; max = end + 1; return builder; },
    maybeSingle() { single = true; return builder; },
    single() { single = true; return builder; },
    insert(value: Row | Row[]) { operation = "insert"; payload = value; return builder; },
    upsert(value: Row) { operation = "upsert"; payload = value; return builder; },
    update(value: Row) { operation = "update"; payload = value; return builder; },
    delete() { operation = "delete"; return builder; },
    then(resolve: (result: { data: Row | Row[] | null; error: { message: string } | null; count: number }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve().then(() => {
        h.queries.push({ table, operation, filters });
        h.timeline.push(`${table}:${operation}`);
        const rows = h.rows[table] ?? [];
        let matched = rows.filter(row => predicates.every(predicate => predicate(row))).slice(offset, max);
        const failure = h.failure?.table === table && h.failure.operation === operation ? h.failure : null;
        if (failure?.throws) throw new Error("Database tijdelijk niet beschikbaar.");
        if (failure) return { data: failure.withData ? (single ? matched[0] ?? null : matched) : null, error: { message: "database failure" }, count: 0 };
        if (operation === "update" && table === "articles" && h.zeroArticleUpdate) matched = [];
        if (operation === "update") matched.forEach(row => Object.assign(row, payload));
        if (operation === "delete") h.rows[table] = rows.filter(row => !matched.includes(row));
        if (operation === "insert" || operation === "upsert") {
          matched = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: "inserted", ...row }));
          h.rows[table] = [...rows, ...matched];
        }
        const projected = matched.map(row => columns === "*" ? { ...row } : Object.fromEntries(
          columns.split(",").map(column => [column.trim(), row[column.trim()]]),
        ));
        return { data: !selected || head ? null : single ? projected[0] ?? null : projected, error: null, count: matched.length };
      }).then(resolve, reject);
    },
  };
  return builder;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function run(action: (data: FormData) => Promise<void>, fields: Record<string, string>) {
  try {
    await action(form(fields));
  } catch (error) {
    expect(error).toHaveProperty("digest", expect.stringContaining("NEXT_REDIRECT"));
    return decodeURIComponent((error as Error).message);
  }
  throw new Error("Expected action to redirect");
}

function writes() { return h.queries.filter(item => item.operation !== "select"); }

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: "user-owner" };
  h.creator = { id: "creator-owner", slug: "maker" };
  h.failure = null;
  h.zeroArticleUpdate = false;
  h.queries = [];
  h.from.mockImplementation(query);
  h.timeline = [];
  h.rpc.mockImplementation(async (name: string, args: Row) => {
    h.timeline.push(`rpc:${name}`);
    if (name === "graph_article_fingerprint") return { data: "fixture-fingerprint", error: null };
    if (name === "graph_propose_article_suggestions") {
      return { data: (args.p_proposals as Row[]).length, error: null };
    }
    throw new Error(`Unexpected RPC: ${name}`);
  });
  h.upload.mockResolvedValue("https://cdn.example.test/gallery.jpg");
  h.rows = {
    projects: [{ id: PROJECT, slug: "test-project", created_by_user_id: "user-owner" }],
    project_gallery_images: [{ id: CHILD, project_id: PROJECT, image_url: "original" }],
    project_product_links: [{ id: CHILD, project_id: PROJECT, product_id: PRODUCT }],
    project_sought_materials: [{ id: CHILD, project_id: PROJECT, title: "Existing material" }],
    products: [{ id: PRODUCT, creator_id: "creator-owner", product_type: "supply", title: "Knitting yarn", domain_id: DOMAIN, is_active: true, status: "active" }],
    workshops: [], events: [], event_domains: [],
    articles: [{ id: ARTICLE, author_creator_id: "creator-owner", title: "Original", slug: "original" }],
    entity_links: [
      { id: "association", source_entity_type: "creator", source_entity_id: "creator-owner", target_entity_type: "project", target_entity_id: PROJECT, relation_type: "related" },
      { id: "old-suggestion", source_entity_type: "article", source_entity_id: ARTICLE, target_entity_type: "product", target_entity_id: "old-product", relation_type: "suggested_auto" },
      { id: "approved-link", source_entity_type: "article", source_entity_id: ARTICLE, target_entity_type: "product", target_entity_id: "approved-product", relation_type: "related" },
    ],
  };
});

const projectCases = [
  { name: "gallery insert", action: createProjectGalleryImageAction, fields: { project_id: PROJECT }, table: "project_gallery_images", operation: "insert" },
  { name: "gallery delete", action: deleteProjectGalleryImageAction, fields: { gallery_image_id: CHILD, project_id: "untrusted-form-project" }, table: "project_gallery_images", operation: "delete" },
  { name: "product link upsert", action: createProjectProductLinkAction, fields: { project_id: PROJECT, product_id: PRODUCT }, table: "project_product_links", operation: "upsert" },
  { name: "product link delete", action: deleteProjectProductLinkAction, fields: { project_product_link_id: CHILD, project_id: "untrusted-form-project" }, table: "project_product_links", operation: "delete" },
  { name: "sought material insert", action: createProjectSoughtMaterialAction, fields: { project_id: PROJECT, title: "Yarn" }, table: "project_sought_materials", operation: "insert" },
  { name: "sought material delete", action: deleteProjectSoughtMaterialAction, fields: { sought_material_id: CHILD, project_id: "untrusted-form-project" }, table: "project_sought_materials", operation: "delete" },
] as const;

describe.each(projectCases)("project authorization: $name", ({ action, fields, table, operation }) => {
  it("rejects a foreign project even with a preexisting caller-created link", async () => {
    h.rows.projects[0].created_by_user_id = "foreign-user";
    const original = structuredClone(h.rows);
    expect(await run(action, fields)).toContain("?error=Geen rechten op dit project.");
    expect(writes()).toEqual([]);
    expect(h.rows).toEqual(original);
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.revalidate).not.toHaveBeenCalled();
  });

  it.each([true, false])("allows the actual owner (association exists: %s)", async (linked) => {
    if (!linked) h.rows.entity_links = [];
    expect(await run(action, fields)).toContain("?success=");
    expect(writes()).toEqual([expect.objectContaining({ table, operation })]);
    expect(h.queries).toContainEqual(expect.objectContaining({
      table: "projects", filters: expect.arrayContaining([["id", PROJECT], ["created_by_user_id", "user-owner"]]),
    }));
    expect(h.revalidate).toHaveBeenCalledWith("/project/test-project");
  });

  it.each([false, true])("fails closed on ownership lookup errors (data present: %s)", async (withData) => {
    h.failure = { table: "projects", operation: "select", withData };
    expect(await run(action, fields)).toContain("?error=");
    expect(writes()).toEqual([]);
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.revalidate).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent project", async () => {
    h.rows.projects = [];
    expect(await run(action, fields)).toContain("?error=");
    expect(writes()).toEqual([]);
  });

  it("requires authentication before database or storage access", async () => {
    h.user = null;
    expect(await run(action, fields)).toContain("/login?");
    expect(h.queries).toEqual([]);
    expect(h.upload).not.toHaveBeenCalled();
  });

  it("reports mutation errors without success or cache invalidation", async () => {
    h.failure = { table, operation };
    const original = structuredClone(h.rows);
    expect(await run(action, fields)).toContain("?error=");
    expect(h.rows).toEqual(original);
    expect(h.revalidate).not.toHaveBeenCalled();
  });
});

it("allows a public project association without granting gallery edit rights", async () => {
  h.rows.projects[0].created_by_user_id = "foreign-user";
  h.rows.entity_links = [];
  expect(await run(createCreatorEntityLinkAction, {
    target_entity_type: "project", target_entity_id: PROJECT, relation_type: "related",
  })).toContain("?success=");
  h.queries = [];
  h.revalidate.mockClear();
  expect(await run(deleteProjectGalleryImageAction, { gallery_image_id: CHILD })).toContain("?error=Geen rechten op dit project.");
  expect(writes()).toEqual([]);
  expect(h.rows.project_gallery_images).toHaveLength(1);
});

const articleFields = { id: ARTICLE, title: "Knitting yarn", article_type: "tutorial", domain_id: DOMAIN };
describe("article recommendation authorization", () => {
  it.each(["foreign author", "missing article", "zero-row owner update"])("does not touch recommendations on %s", async (scenario) => {
    if (scenario === "foreign author") h.rows.articles[0].author_creator_id = "foreign-creator";
    if (scenario === "missing article") h.rows.articles = [];
    if (scenario === "zero-row owner update") h.zeroArticleUpdate = true;
    const original = structuredClone(h.rows);
    expect(await run(updateArticleAction, articleFields)).toContain("?error=Bijwerken van artikel mislukt.");
    expect(h.rows).toEqual(original);
    expect(h.queries.filter(item => item.table !== "articles")).toEqual([]);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.revalidate).not.toHaveBeenCalled();
  });

  it.each(["returned error", "error with data", "thrown error"])("does not touch recommendations after an article DB %s", async (mode) => {
    h.failure = { table: "articles", operation: "update", withData: mode === "error with data", throws: mode === "thrown error" };
    const original = structuredClone(h.rows);
    expect(await run(updateArticleAction, articleFields)).toContain("?error=");
    expect(h.rows).toEqual(original);
    expect(h.queries.filter(item => item.table !== "articles")).toEqual([]);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.revalidate).not.toHaveBeenCalled();
  });

  it("proposes recommendations atomically after an owner-matched update without changing retained links", async () => {
    const originalLinks = structuredClone(h.rows.entity_links);
    // Existing manual and automatic pairs are still eligible catalog matches,
    // but must be suppressed rather than deleted, relabelled or renominated.
    h.rows.products.push(...["old-product", "approved-product"].map(id => ({ ...h.rows.products[0], id })));
    const location = new URL(await run(updateArticleAction, articleFields), "https://fixture.invalid");
    expect(location.pathname).toBe("/profile");
    expect(location.searchParams.get("tab")).toBe("profiel");
    expect(location.searchParams.get("success")).toBe("Artikel bijgewerkt. Suggesties vernieuwd.");
    expect(location.searchParams.has("error")).toBe(false);
    expect(h.rows.articles[0].title).toBe("Knitting yarn");
    expect(writes()).toEqual([{
      table: "articles", operation: "update", filters: [["id", ARTICLE], ["author_creator_id", "creator-owner"]],
    }]);
    expect(h.rows.entity_links).toEqual(originalLinks);
    expect(h.rpc.mock.calls).toEqual([
      ["graph_article_fingerprint", { p_article_id: ARTICLE }],
      ["graph_propose_article_suggestions", {
        p_article_id: ARTICLE, p_fingerprint: "fixture-fingerprint", p_proposals: [{
          target_entity_type: "product", target_entity_id: PRODUCT,
          weight: expect.any(Number), sort_order: 1, proposed_relation: "related_product",
          score: expect.any(Number), evidence: expect.arrayContaining([
            "Onderwerp (titel): Knitting yarn → Knitting yarn (garen)",
            "Aanbeveling; materiaalcompatibiliteit onbekend.",
          ]), compatibility: "unknown", matcher_version: "article-catalog-v1",
        }],
      }],
    ]);
    expect(h.timeline.indexOf("articles:update")).toBeLessThan(h.timeline.indexOf("rpc:graph_article_fingerprint"));
    expect(h.timeline.indexOf("rpc:graph_article_fingerprint")).toBeLessThan(h.timeline.lastIndexOf("articles:select"));
    expect(h.timeline.lastIndexOf("entity_links:select")).toBeLessThan(h.timeline.indexOf("rpc:graph_propose_article_suggestions"));
    expect(h.revalidate).toHaveBeenCalledWith("/profile");
  });
});
