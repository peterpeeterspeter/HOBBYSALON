import {
  createMerchantCategoryMappingAction,
  createMerchantFeedSourceAction,
  runMerchantFeedPullAction,
  runMerchantImportDryRunAction,
  submitMerchantImportAction,
  triggerMaterialsProjectionSyncAction,
  updateMaterialsRuleAction,
  updateMerchantFeedSourceAction,
} from "@/app/actions/materials-ops";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import {
  getMerchantImportJobDetail,
  getMerchantFeedSourceMetrics,
  getMerchantMaterialsDetail,
  listConfigurationRules,
  listMerchantFeedSourceRuns,
  listMaterialCategoryOptions,
  listMerchantMaterialsOverview,
} from "@/lib/commerce/medusa/materials-ops";
import { hasMedusaAdminAccess } from "@/lib/commerce/medusa/medusa-admin-auth";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GridLayout } from "@/components/layout/grid-layout";

type Props = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    merchant_q?: string;
    seller_id?: string;
    feed_id?: string;
    import_job_id?: string;
  }>;
};

type MaterialProjectionRow = {
  id: string;
  medusa_product_id: string | null;
  slug: string;
  title: string;
  status: string;
  is_active: boolean;
  domain_id: string | null;
  category_id: string | null;
  updated_at: string;
};

type DryRunSnapshot = {
  seller_id: string;
  file_name: string;
  total_count: number;
  valid_count: number;
  error_count: number;
  unmapped_count: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  preview: Array<{
    row: number;
    title: string;
    status: string;
    source_category?: string;
    domain_id?: string;
  }>;
  created_at: string;
};

type MerchantProjectionLinkage = {
  sampledMedusaProducts: number;
  linkedPlatformProducts: number;
  missingPlatformLinks: number;
  linkedCreators: Array<{
    id: string;
    slug: string | null;
    display_name: string | null;
  }>;
};

const FEED_MAPPING_PRESETS = [
  { value: "none", label: "Geen preset (custom)" },
  { value: "custom_csv_basic", label: "CSV basis" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "shopify", label: "Shopify" },
];

function getDryRunCookieName(sellerId: string) {
  return `hs_materials_dry_run_${sellerId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function getProjectionStats() {
  const supabase = createPlatformClient();

  const [total, active, archived, missingDomain, missingCategory, latest] =
    await Promise.all([
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("product_type", "supply")
        .not("medusa_product_id", "is", null),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("product_type", "supply")
        .not("medusa_product_id", "is", null)
        .eq("is_active", true),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("product_type", "supply")
        .not("medusa_product_id", "is", null)
        .eq("status", "archived"),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("product_type", "supply")
        .not("medusa_product_id", "is", null)
        .is("domain_id", null),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("product_type", "supply")
        .not("medusa_product_id", "is", null)
        .is("category_id", null),
      supabase
        .from("products")
        .select(
          "id, medusa_product_id, slug, title, status, is_active, domain_id, category_id, updated_at"
        )
        .eq("product_type", "supply")
        .not("medusa_product_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(12),
    ]);

  return {
    total: total.count ?? 0,
    active: active.count ?? 0,
    archived: archived.count ?? 0,
    missingDomain: missingDomain.count ?? 0,
    missingCategory: missingCategory.count ?? 0,
    latest: (latest.data ?? []) as MaterialProjectionRow[],
  };
}

async function getMerchantProjectionLinkage(
  medusaProductIds: string[]
): Promise<MerchantProjectionLinkage> {
  const uniqueMedusaIds = [...new Set(medusaProductIds.filter(Boolean))];
  if (!uniqueMedusaIds.length) {
    return {
      sampledMedusaProducts: 0,
      linkedPlatformProducts: 0,
      missingPlatformLinks: 0,
      linkedCreators: [],
    };
  }

  const supabase = createPlatformClient();
  const { data: linkedProducts } = await supabase
    .from("products")
    .select("id, creator_id, medusa_product_id")
    .eq("product_type", "supply")
    .in("medusa_product_id", uniqueMedusaIds);

  const linkedRows =
    (linkedProducts as Array<{ id: string; creator_id: string; medusa_product_id: string }> | null) ??
    [];
  const creatorIds = [...new Set(linkedRows.map((row) => row.creator_id).filter(Boolean))];
  const { data: creators } = creatorIds.length
    ? await supabase
        .from("creators")
        .select("id, slug, display_name")
        .in("id", creatorIds)
    : { data: [] as Array<{ id: string; slug: string | null; display_name: string | null }> };

  return {
    sampledMedusaProducts: uniqueMedusaIds.length,
    linkedPlatformProducts: linkedRows.length,
    missingPlatformLinks: Math.max(0, uniqueMedusaIds.length - linkedRows.length),
    linkedCreators:
      (creators as Array<{ id: string; slug: string | null; display_name: string | null }> | null) ??
      [],
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function DashboardMaterialsPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/materials");
  }

  const registrationContext = await getUserRegistrationContext(user.id);
  if (!registrationContext.roles.includes("merchant")) {
    redirect(`/register/merchant?next=${encodeURIComponent("/dashboard/materials")}`);
  }

  const {
    success,
    error,
    merchant_q: merchantQ,
    seller_id: selectedSellerId,
    feed_id: selectedFeedId,
    import_job_id: selectedImportJobId,
  } = await searchParams;
  const stats = await getProjectionStats();
  const merchantOverview = await listMerchantMaterialsOverview({
    q: merchantQ,
    limit: 25,
    offset: 0,
  });
  const merchantDetail = selectedSellerId
    ? await getMerchantMaterialsDetail(selectedSellerId)
    : null;
  const dryRunSnapshot = selectedSellerId
    ? (() => {
        const read = async () => {
          const cookieStore = await cookies();
          const raw = cookieStore.get(getDryRunCookieName(selectedSellerId))?.value;
          if (!raw) return null;
          try {
            return JSON.parse(raw) as DryRunSnapshot;
          } catch {
            return null;
          }
        };
        return read();
      })()
    : Promise.resolve(null);
  const materialCategories = await listMaterialCategoryOptions();
  const configurationRules = await listConfigurationRules();
  const requireProductApprovalRule =
    configurationRules.find((rule) => rule.rule_type === "require_product_approval") || null;
  const productImportEnabledRule =
    configurationRules.find((rule) => rule.rule_type === "product_import_enabled") || null;
  const categoryOptions = materialCategories.map((category) => ({
    value: category.id,
    label: `${category.name} (${category.handle})`,
  }));
  const canTriggerSync = await hasMedusaAdminAccess();
  const dryRun = await dryRunSnapshot;
  const selectedFeed =
    selectedFeedId && merchantDetail
      ? merchantDetail.merchant.latest.feed_sources.find(
          (feed) => feed.id === selectedFeedId
        ) || null
      : null;
  const selectedImportJob =
    merchantDetail &&
    (selectedImportJobId ||
      merchantDetail.merchant.latest.import_jobs[0]?.id)
      ? await getMerchantImportJobDetail(
          merchantDetail.merchant.seller_id,
          selectedImportJobId || merchantDetail.merchant.latest.import_jobs[0]?.id || ""
        )
      : null;
  const [selectedFeedRuns, selectedFeedMetrics] =
    selectedFeed && merchantDetail
      ? await Promise.all([
          listMerchantFeedSourceRuns(merchantDetail.merchant.seller_id, selectedFeed.id),
          getMerchantFeedSourceMetrics(merchantDetail.merchant.seller_id, selectedFeed.id),
        ])
      : [[], null];
  const merchantProjectionLinkage = merchantDetail
    ? await getMerchantProjectionLinkage(
        merchantDetail.merchant.latest.products
          .map((product) => product.id)
          .filter(Boolean)
      )
    : null;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">
        Materials Marketplace Ops
      </h1>
      <p className="text-[var(--muted)]">
        Projection-monitoring tussen Medusa merchant catalogus en platform
        supplies.
      </p>

      {success && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <GridLayout cols={4}>
        <CardShell variant="default" padding="lg">
          <p className="text-sm text-[var(--muted)]">Projected supplies</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
            {stats.total}
          </p>
        </CardShell>
        <CardShell variant="default" padding="lg">
          <p className="text-sm text-[var(--muted)]">Active</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
            {stats.active}
          </p>
        </CardShell>
        <CardShell variant="default" padding="lg">
          <p className="text-sm text-[var(--muted)]">Archived</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
            {stats.archived}
          </p>
        </CardShell>
        <CardShell variant="default" padding="lg">
          <p className="text-sm text-[var(--muted)]">Mapping gaps</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
            {stats.missingDomain + stats.missingCategory}
          </p>
          <p className="text-xs text-[var(--muted)]">
            domain: {stats.missingDomain} · category: {stats.missingCategory}
          </p>
        </CardShell>
      </GridLayout>

      <CardShell variant="featured" padding="lg">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Force projection sync
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Queues batches via <code>/admin/platform/products/projection/sync</code>.
        </p>

        {!canTriggerSync ? (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Set <code>MEDUSA_ADMIN_EMAIL</code> / <code>MEDUSA_ADMIN_PASSWORD</code>{" "}
            (or <code>MEDUSA_ADMIN_API_TOKEN</code>) on storefront server to enable this.
          </p>
        ) : (
          <form action={triggerMaterialsProjectionSyncAction} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
              <Input
                name="seller_id"
                label="Seller ID (optional)"
                placeholder="sel_..."
              />
              <Input
                name="limit"
                label="Batch size (optional, max 500)"
                defaultValue="200"
              />
            </div>
            <Button type="submit">Queue Sync</Button>
          </form>
        )}
      </CardShell>

      <CardShell variant="default" padding="lg">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Approval & import rules
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          P1 controls for merchant product auto-approval and import availability.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {requireProductApprovalRule ? (
            <form
              action={updateMaterialsRuleAction}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <input type="hidden" name="seller_id" value={selectedSellerId ?? ""} />
              <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
              <input type="hidden" name="rule_id" value={requireProductApprovalRule.id} />
              <p className="font-medium">Require product approval</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                {requireProductApprovalRule.is_enabled
                  ? "Enabled: nieuwe producten vereisen approval."
                  : "Disabled: auto-approval actief."}
              </p>
              <label className="mt-3 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_enabled"
                  defaultChecked={requireProductApprovalRule.is_enabled}
                />
                Rule enabled
              </label>
              <div className="mt-3">
                <Button type="submit" size="sm" variant="secondary">
                  Save rule
                </Button>
              </div>
            </form>
          ) : (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Rule <code>require_product_approval</code> not found.
            </p>
          )}

          {productImportEnabledRule ? (
            <form
              action={updateMaterialsRuleAction}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <input type="hidden" name="seller_id" value={selectedSellerId ?? ""} />
              <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
              <input type="hidden" name="rule_id" value={productImportEnabledRule.id} />
              <p className="font-medium">Product import enabled</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                {productImportEnabledRule.is_enabled
                  ? "Enabled: CSV/feed import toegestaan."
                  : "Disabled: import route geblokkeerd."}
              </p>
              <label className="mt-3 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_enabled"
                  defaultChecked={productImportEnabledRule.is_enabled}
                />
                Rule enabled
              </label>
              <div className="mt-3">
                <Button type="submit" size="sm" variant="secondary">
                  Save rule
                </Button>
              </div>
            </form>
          ) : (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Rule <code>product_import_enabled</code> not found.
            </p>
          )}
        </div>
      </CardShell>

      <CardShell variant="default" padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Merchant readiness
          </h2>
          <form method="GET" className="flex items-end gap-2">
            <Input
              name="merchant_q"
              label="Search merchant"
              defaultValue={merchantQ ?? ""}
              placeholder="name or handle"
            />
            <Button type="submit" variant="secondary" size="sm">
              Filter
            </Button>
          </form>
        </div>

        {!merchantOverview ? (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Merchant overview unavailable. Configure Medusa admin credentials{" "}
            (<code>MEDUSA_ADMIN_EMAIL</code> / <code>MEDUSA_ADMIN_PASSWORD</code> or{" "}
            <code>MEDUSA_ADMIN_API_TOKEN</code>) on the storefront server.
          </p>
        ) : merchantOverview.merchants.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No merchant sellers found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                  <th className="px-2 py-2">Merchant</th>
                  <th className="px-2 py-2">Published</th>
                  <th className="px-2 py-2">Mappings</th>
                  <th className="px-2 py-2">Imports</th>
                  <th className="px-2 py-2">Feeds</th>
                  <th className="px-2 py-2">Sync jobs</th>
                </tr>
              </thead>
              <tbody>
                {merchantOverview.merchants.map((merchant) => {
                  const ready =
                    merchant.category_mapping_count > 0 &&
                    merchant.import_job_count > 0;

                  return (
                    <tr
                      key={merchant.seller_id}
                      className="border-b border-[var(--border)]/60 text-[var(--foreground)]"
                    >
                      <td className="px-2 py-2">
                        <div className="font-medium">
                          {merchant.seller_name || merchant.seller_handle || merchant.seller_id}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {merchant.seller_id} · {merchant.store_status || "unknown"} ·{" "}
                          {ready ? "ready" : "needs setup"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button asChild variant="ghost" size="sm">
                            <a
                              href={`/dashboard/materials?merchant_q=${encodeURIComponent(
                                merchantQ ?? ""
                              )}&seller_id=${encodeURIComponent(merchant.seller_id)}`}
                            >
                              Details
                            </a>
                          </Button>
                          {canTriggerSync && (
                            <form action={triggerMaterialsProjectionSyncAction}>
                              <input type="hidden" name="seller_id" value={merchant.seller_id} />
                              <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
                              <input type="hidden" name="limit" value="200" />
                              <Button type="submit" variant="secondary" size="sm">
                                Sync seller
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">{merchant.published_product_count}</td>
                      <td className="px-2 py-2">{merchant.category_mapping_count}</td>
                      <td className="px-2 py-2">{merchant.import_job_count}</td>
                      <td className="px-2 py-2">{merchant.feed_source_count}</td>
                      <td className="px-2 py-2">{merchant.sync_job_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>

      {merchantDetail && (
        <CardShell variant="default" padding="lg">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Merchant detail:{" "}
            {merchantDetail.merchant.seller_name ||
              merchantDetail.merchant.seller_handle ||
              merchantDetail.merchant.seller_id}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {merchantDetail.merchant.seller_id} ·{" "}
            {merchantDetail.merchant.store_status || "unknown"}
          </p>

          <GridLayout cols={4} className="mt-4">
            <CardShell variant="default" padding="md">
              <p className="text-xs text-[var(--muted)]">Mappings</p>
              <p className="text-xl font-semibold">
                {merchantDetail.merchant.counts.category_mappings}
              </p>
            </CardShell>
            <CardShell variant="default" padding="md">
              <p className="text-xs text-[var(--muted)]">Import jobs</p>
              <p className="text-xl font-semibold">
                {merchantDetail.merchant.counts.import_jobs}
              </p>
            </CardShell>
            <CardShell variant="default" padding="md">
              <p className="text-xs text-[var(--muted)]">Feed sources</p>
              <p className="text-xl font-semibold">
                {merchantDetail.merchant.counts.feed_sources}
              </p>
            </CardShell>
            <CardShell variant="default" padding="md">
              <p className="text-xs text-[var(--muted)]">Published products</p>
              <p className="text-xl font-semibold">
                {merchantDetail.merchant.counts.published_products}
              </p>
            </CardShell>
          </GridLayout>

          {merchantProjectionLinkage && (
            <div className="mt-4 rounded-lg border border-[var(--border)] p-3">
              <h3 className="font-medium">Supplier/seller linkage sample</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                sampled Medusa products: {merchantProjectionLinkage.sampledMedusaProducts} ·
                linked platform supplies: {merchantProjectionLinkage.linkedPlatformProducts} ·
                missing links: {merchantProjectionLinkage.missingPlatformLinks}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {merchantProjectionLinkage.linkedCreators.slice(0, 10).map((creator) => (
                  <span
                    key={creator.id}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                  >
                    {creator.display_name || creator.slug || creator.id}
                  </span>
                ))}
                {merchantProjectionLinkage.linkedCreators.length === 0 && (
                  <span className="text-sm text-[var(--muted)]">
                    No linked creators found in sampled projected supplies.
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] p-3">
              <h3 className="font-medium">Latest mappings</h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                {merchantDetail.merchant.latest.category_mappings
                  .slice(0, 5)
                  .map((item) => (
                    <li key={item.id}>
                      {item.source_category || "-"} → {item.product_category_id || "-"}{" "}
                      {item.active ? "· active" : "· inactive"}
                    </li>
                  ))}
                {merchantDetail.merchant.latest.category_mappings.length === 0 && (
                  <li>No mappings yet.</li>
                )}
              </ul>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <h3 className="font-medium">Latest imports</h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                {merchantDetail.merchant.latest.import_jobs
                  .slice(0, 5)
                  .map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2">
                      <span>
                        {item.status} · rows {item.total_count} ·{" "}
                        {formatDate(item.created_at)}
                      </span>
                      <Button asChild type="button" size="sm" variant="ghost">
                        <a
                          href={`/dashboard/materials?merchant_q=${encodeURIComponent(
                            merchantQ ?? ""
                          )}&seller_id=${encodeURIComponent(
                            merchantDetail.merchant.seller_id
                          )}&import_job_id=${encodeURIComponent(item.id)}`}
                        >
                          Inspect
                        </a>
                      </Button>
                    </li>
                  ))}
                {merchantDetail.merchant.latest.import_jobs.length === 0 && (
                  <li>No import jobs yet.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--border)] p-3">
            <h3 className="font-medium">Feed sources</h3>
            <form
              action={createMerchantFeedSourceAction}
              className="mt-3 grid gap-3 lg:grid-cols-4"
            >
              <input
                type="hidden"
                name="seller_id"
                value={merchantDetail.merchant.seller_id}
              />
              <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
              <Input name="name" label="Name" placeholder="Merchant CSV feed" required />
              <Input
                name="url"
                label="Feed URL"
                placeholder="https://merchant.example/feed.csv"
                required
              />
              <Select
                name="provider"
                label="Provider"
                options={[
                  { value: "custom_csv", label: "custom_csv" },
                  { value: "custom_json", label: "custom_json" },
                  { value: "woocommerce", label: "woocommerce" },
                  { value: "shopify", label: "shopify" },
                ]}
                defaultValue="custom_csv"
                required
              />
              <Select
                name="method"
                label="Method"
                options={[
                  { value: "GET", label: "GET" },
                  { value: "POST", label: "POST" },
                ]}
                defaultValue="GET"
                required
              />
              <Input name="default_currency" label="Default currency" placeholder="eur" />
              <Input
                name="default_location_id"
                label="Default location ID"
                placeholder="sloc_..."
              />
              <Input
                name="pull_interval_minutes"
                label="Pull interval (min)"
                defaultValue="60"
              />
              <Select
                name="mapping_preset"
                label="Mapping preset"
                options={FEED_MAPPING_PRESETS}
                defaultValue="custom_csv_basic"
              />
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Headers JSON
                </label>
                <textarea
                  name="headers_json"
                  rows={3}
                  defaultValue="{}"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)]"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Mapping JSON (optional override)
                </label>
                <textarea
                  name="mapping_json"
                  rows={3}
                  defaultValue=""
                  placeholder='{"sku":"sku","price_amount":"price"}'
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)]"
                />
              </div>
              <label className="flex items-end gap-2 text-sm">
                <input type="checkbox" name="auto_pull_enabled" />
                Auto pull enabled
              </label>
              <div className="flex items-end">
                <Button type="submit" variant="secondary" size="sm">
                  Add feed
                </Button>
              </div>
            </form>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Provider</th>
                    <th className="px-2 py-2">URL</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {merchantDetail.merchant.latest.feed_sources.map((feed) => (
                    <tr key={feed.id} className="border-b border-[var(--border)]/60">
                      <td className="px-2 py-2">{feed.name || feed.id}</td>
                      <td className="px-2 py-2">{feed.provider || "-"}</td>
                      <td className="px-2 py-2 max-w-[320px] truncate">{feed.url || "-"}</td>
                      <td className="px-2 py-2">
                        {feed.active ? "active" : "inactive"} ·{" "}
                        {feed.auto_pull_enabled ? "auto" : "manual"}
                      </td>
                      <td className="px-2 py-2">
                        <form
                          action={updateMerchantFeedSourceAction}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="seller_id"
                            value={merchantDetail.merchant.seller_id}
                          />
                          <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
                          <input type="hidden" name="feed_id" value={feed.id} />
                          <input type="hidden" name="name" value={feed.name || ""} />
                          <input type="hidden" name="provider" value={feed.provider || "custom_csv"} />
                          <input type="hidden" name="url" value={feed.url || ""} />
                          <input type="hidden" name="method" value={feed.method || "GET"} />
                          <input
                            type="hidden"
                            name="default_currency"
                            value={feed.default_currency || ""}
                          />
                          <input
                            type="hidden"
                            name="default_location_id"
                            value={feed.default_location_id || ""}
                          />
                          <input
                            type="hidden"
                            name="pull_interval_minutes"
                            value={String(feed.pull_interval_minutes ?? 60)}
                          />
                          <input type="hidden" name="active" value={feed.active ? "" : "on"} />
                          {feed.auto_pull_enabled && (
                            <input type="hidden" name="auto_pull_enabled" value="on" />
                          )}
                          <Button type="submit" size="sm" variant="ghost">
                            {feed.active ? "Disable" : "Enable"}
                          </Button>
                          <Button asChild type="button" size="sm" variant="ghost">
                            <a
                              href={`/dashboard/materials?merchant_q=${encodeURIComponent(
                                merchantQ ?? ""
                              )}&seller_id=${encodeURIComponent(
                                merchantDetail.merchant.seller_id
                              )}&feed_id=${encodeURIComponent(feed.id)}`}
                            >
                              Edit
                            </a>
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {merchantDetail.merchant.latest.feed_sources.length === 0 && (
                    <tr>
                      <td className="px-2 py-2 text-[var(--muted)]" colSpan={5}>
                        No feed sources yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--border)] p-3">
            <h3 className="font-medium">CSV import</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <form action={runMerchantImportDryRunAction} className="space-y-3" encType="multipart/form-data">
                <input
                  type="hidden"
                  name="seller_id"
                  value={merchantDetail.merchant.seller_id}
                />
                <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
                <Input name="csv_file" label="CSV file" type="file" accept=".csv,text/csv" required />
                <div className="grid gap-3 md:grid-cols-2">
                  <Input name="delimiter" label="Delimiter (optional)" placeholder="," />
                  <Input name="currency_code" label="Default currency (optional)" placeholder="eur" />
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Run dry-run
                </Button>
              </form>

              <form action={submitMerchantImportAction} className="space-y-3" encType="multipart/form-data">
                <input
                  type="hidden"
                  name="seller_id"
                  value={merchantDetail.merchant.seller_id}
                />
                <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
                <Input
                  name="csv_file"
                  label="CSV file (submit)"
                  type="file"
                  accept=".csv,text/csv"
                  required
                />
                <Button type="submit" size="sm">
                  Submit import
                </Button>
              </form>
            </div>

            {dryRun && dryRun.seller_id === merchantDetail.merchant.seller_id && (
              <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
                <p className="text-sm font-medium">
                  Last dry-run: {dryRun.file_name} ({formatDate(dryRun.created_at)})
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  total {dryRun.total_count} · valid {dryRun.valid_count} · errors{" "}
                  {dryRun.error_count} · unmapped {dryRun.unmapped_count}
                </p>
                {dryRun.errors.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-[var(--muted)]">
                    {dryRun.errors.map((item, idx) => (
                      <li key={`${item.row}-${idx}`}>
                        row {item.row}
                        {item.field ? ` (${item.field})` : ""}: {item.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selectedImportJob && (
              <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
                <p className="text-sm font-medium">
                  Import job: {selectedImportJob.job.id}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {selectedImportJob.job.status} · processed{" "}
                  {selectedImportJob.job.processed_count}/{selectedImportJob.job.total_count} ·
                  accepted {selectedImportJob.job.accepted_count} · rejected{" "}
                  {selectedImportJob.job.rejected_count} · pending{" "}
                  {selectedImportJob.job.pending_count}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  file: {selectedImportJob.job.file_name || "-"} · updated{" "}
                  {formatDate(selectedImportJob.job.updated_at)}
                </p>
                {selectedImportJob.job.error_message && (
                  <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {selectedImportJob.job.error_message}
                  </p>
                )}
                {selectedImportJob.items.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                          <th className="px-2 py-2">Request</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2">Row</th>
                          <th className="px-2 py-2">Product</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedImportJob.items.map((item) => (
                          <tr key={item.request_id} className="border-b border-[var(--border)]/60">
                            <td className="px-2 py-2">{item.request_id}</td>
                            <td className="px-2 py-2">{item.status}</td>
                            <td className="px-2 py-2">{item.import_row_index ?? "-"}</td>
                            <td className="px-2 py-2">{item.product_id ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedFeed && (
            <div className="mt-4 rounded-lg border border-[var(--border)] p-3">
              <h3 className="font-medium">Feed editor: {selectedFeed.name || selectedFeed.id}</h3>
              <form
                action={updateMerchantFeedSourceAction}
                className="mt-3 grid gap-3 lg:grid-cols-4"
              >
                <input
                  type="hidden"
                  name="seller_id"
                  value={merchantDetail.merchant.seller_id}
                />
                <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
                <input type="hidden" name="feed_id" value={selectedFeed.id} />
                <Input name="name" label="Name" defaultValue={selectedFeed.name || ""} required />
                <Input name="url" label="URL" defaultValue={selectedFeed.url || ""} required />
                <Select
                  name="provider"
                  label="Provider"
                  options={[
                    { value: "custom_csv", label: "custom_csv" },
                    { value: "custom_json", label: "custom_json" },
                    { value: "woocommerce", label: "woocommerce" },
                    { value: "shopify", label: "shopify" },
                  ]}
                  defaultValue={selectedFeed.provider || "custom_csv"}
                  required
                />
                <Select
                  name="method"
                  label="Method"
                  options={[
                    { value: "GET", label: "GET" },
                    { value: "POST", label: "POST" },
                  ]}
                  defaultValue={selectedFeed.method || "GET"}
                  required
                />
                <Input
                  name="default_currency"
                  label="Default currency"
                  defaultValue={selectedFeed.default_currency || ""}
                />
                <Input
                  name="default_location_id"
                  label="Default location ID"
                  defaultValue={selectedFeed.default_location_id || ""}
                />
                <Input
                  name="pull_interval_minutes"
                  label="Pull interval (min)"
                  defaultValue={String(selectedFeed.pull_interval_minutes ?? 60)}
                />
                <Select
                  name="mapping_preset"
                  label="Mapping preset"
                  options={FEED_MAPPING_PRESETS}
                  defaultValue="none"
                />
                <label className="flex items-end gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={selectedFeed.active} />
                  Active
                </label>
                <label className="flex items-end gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="auto_pull_enabled"
                    defaultChecked={selectedFeed.auto_pull_enabled}
                  />
                  Auto pull
                </label>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Headers JSON
                  </label>
                  <textarea
                    name="headers_json"
                    rows={3}
                    defaultValue={JSON.stringify(selectedFeed.headers || {}, null, 2)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)]"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Mapping JSON (optional override)
                  </label>
                  <textarea
                    name="mapping_json"
                    rows={3}
                    defaultValue={JSON.stringify(selectedFeed.mapping || {}, null, 2)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)]"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="secondary" size="sm">
                    Save feed
                  </Button>
                </div>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={runMerchantFeedPullAction}>
                  <input
                    type="hidden"
                    name="seller_id"
                    value={merchantDetail.merchant.seller_id}
                  />
                  <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
                  <input type="hidden" name="feed_id" value={selectedFeed.id} />
                  <Button type="submit" size="sm">
                    Run manual pull
                  </Button>
                </form>
              </div>

              {selectedFeedMetrics && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <CardShell variant="default" padding="sm">
                    <p className="text-xs text-[var(--muted)]">Runs (14d)</p>
                    <p className="text-xl font-semibold">
                      {selectedFeedMetrics.metrics.total_runs}
                    </p>
                  </CardShell>
                  <CardShell variant="default" padding="sm">
                    <p className="text-xs text-[var(--muted)]">Success rate</p>
                    <p className="text-xl font-semibold">
                      {(selectedFeedMetrics.metrics.success_rate * 100).toFixed(1)}%
                    </p>
                  </CardShell>
                  <CardShell variant="default" padding="sm">
                    <p className="text-xs text-[var(--muted)]">Avg duration</p>
                    <p className="text-xl font-semibold">
                      {selectedFeedMetrics.metrics.avg_duration_ms} ms
                    </p>
                  </CardShell>
                </div>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                      <th className="px-2 py-2">Started</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Trigger</th>
                      <th className="px-2 py-2">Accepted</th>
                      <th className="px-2 py-2">Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFeedRuns.map((run) => (
                      <tr key={run.id} className="border-b border-[var(--border)]/60">
                        <td className="px-2 py-2">{formatDate(run.started_at)}</td>
                        <td className="px-2 py-2">{run.status}</td>
                        <td className="px-2 py-2">{run.trigger_type}</td>
                        <td className="px-2 py-2">{run.accepted_count}</td>
                        <td className="px-2 py-2">{run.rejected_count}</td>
                      </tr>
                    ))}
                    {selectedFeedRuns.length === 0 && (
                      <tr>
                        <td className="px-2 py-2 text-[var(--muted)]" colSpan={5}>
                          No runs yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-[var(--border)] p-3">
            <h3 className="font-medium">Create category mapping</h3>
            {categoryOptions.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No categories available. Check admin token or category setup.
              </p>
            ) : (
              <form
                action={createMerchantCategoryMappingAction}
                className="mt-3 grid gap-3 md:grid-cols-4"
              >
                <input
                  type="hidden"
                  name="seller_id"
                  value={merchantDetail.merchant.seller_id}
                />
                <input type="hidden" name="merchant_q" value={merchantQ ?? ""} />
                <Input
                  name="source_category"
                  label="Source category"
                  placeholder="Garen > Wol > Merino"
                  required
                />
                <Select
                  name="domain_id"
                  label="Platform category"
                  options={categoryOptions}
                  placeholder="Select category"
                  required
                />
                <Input
                  name="confidence"
                  label="Confidence (0-1)"
                  placeholder="0.80"
                />
                <div className="flex items-end">
                  <Button type="submit" variant="secondary" size="sm">
                    Add mapping
                  </Button>
                </div>
              </form>
            )}
          </div>
        </CardShell>
      )}

      <CardShell variant="default" padding="lg">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Recent projected supplies
        </h2>
        {stats.latest.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No projected supply products found yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Slug</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Domain</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {stats.latest.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border)]/60 text-[var(--foreground)]"
                  >
                    <td className="px-2 py-2">{row.title}</td>
                    <td className="px-2 py-2">{row.slug}</td>
                    <td className="px-2 py-2">
                      {row.status}
                      {row.is_active ? " · active" : " · inactive"}
                    </td>
                    <td className="px-2 py-2">{row.domain_id ?? "-"}</td>
                    <td className="px-2 py-2">{row.category_id ?? "-"}</td>
                    <td className="px-2 py-2">{formatDate(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
    </section>
  );
}
