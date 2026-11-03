import type { Metadata } from "next";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Container } from "@/components/ui/container";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { MaterialsPagination } from "@/components/materials/MaterialsPagination";
import { MaterialsHero } from "@/components/materials/MaterialsHero";
import { MaterialsCategoryBrowser } from "@/components/materials/MaterialsCategoryBrowser";
import { MaterialsFilterPanel, type FilterGroup } from "@/components/materials/MaterialsFilterPanel";
import { MaterialsCatalogToolbar } from "@/components/materials/MaterialsCatalogToolbar";
import { MaterialsProductCard } from "@/components/materials/MaterialsProductCard";
import { MaterialsAfterResults } from "@/components/materials/MaterialsAfterResults";
import {
  MATERIALS_PRICE_BAND_OPTIONS,
  resolveMaterialsPriceBand,
  sanitizeAgendaSearchQuery,
} from "@/lib/materials/materials-catalog-helpers";
import { listLatestArticles } from "@/lib/platform/queries/articles";
import {
  listMaterialsCatalog,
  listMaterialsFacets,
  listSupplyCategoryOptions,
  type MaterialsCatalogItem,
  type MaterialsFacetCount,
} from "@/lib/platform/queries/products";
import { listWorkshopsByDomain } from "@/lib/platform/queries/workshops";
import {
  getMedusaProduct,
  getMedusaProductByHandle,
} from "@/lib/commerce/medusa/products";
import { medusaAmountToCents } from "@/lib/commerce/money";
import { publicAssetUrl } from "@/lib/media/public-asset-url";
import { buildRegionalPageMetadata } from "@/lib/markets/regional-seo";
import { getRequestMarket } from "@/lib/markets/request";
import { marketSeoDecision } from "@/lib/markets/seo-policy";

export async function generateMetadata(): Promise<Metadata> {
  const resolution = await getRequestMarket();
  return buildRegionalPageMetadata({
    path: "/materials",
    decision: marketSeoDecision(resolution),
  });
}

type SearchParams = Promise<{
  q?: string;
  category?: string;
  sub?: string;
  domain?: string;
  seller?: string;
  price?: string;
  featured?: string;
  sort?: string;
  page?: string;
}>;

const PAGE_SIZE = 24;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Public materials page is merchant webshop stock only. */
const MATERIALS_PAGE_SCOPE = "merchant" as const;

type MaterialsSort = "recommended" | "newest" | "price_asc" | "price_desc";

async function enrichPagePrices(
  products: MaterialsCatalogItem[]
): Promise<MaterialsCatalogItem[]> {
  return Promise.all(
    products.map(async (product) => {
      if (!product.medusa_product_id) return product;
      const medusaById = await getMedusaProduct(product.medusa_product_id);
      const medusa =
        medusaById ?? (await getMedusaProductByHandle(product.slug));
      const amount = medusa?.calculated_price?.calculated_amount;
      if (!amount || amount <= 0) {
        return {
          ...product,
          featured_image_url: publicAssetUrl(product.featured_image_url),
        };
      }
      return {
        ...product,
        featured_image_url: publicAssetUrl(product.featured_image_url),
        displayPrice: {
          amount: medusaAmountToCents(amount),
          currency_code: medusa?.calculated_price?.currency_code ?? "eur",
        },
      };
    })
  );
}

function buildMaterialsHref(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {}
) {
  const merged = { ...current, ...overrides };
  const query = new URLSearchParams();
  Object.entries(merged).forEach(([key, value]) => {
    if (value && value.trim() && value !== "all") {
      query.set(key, value);
    }
  });
  const serialized = query.toString();
  return serialized ? `/materials?${serialized}` : "/materials";
}

function parseSort(value: string | undefined): MaterialsSort {
  if (
    value === "newest" ||
    value === "price_asc" ||
    value === "price_desc"
  ) {
    return value;
  }
  return "recommended";
}

export default async function MaterialsMarketplacePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = sanitizeAgendaSearchQuery(params.q) ?? undefined;
  const sort = parseSort(params.sort);
  const priceBand = resolveMaterialsPriceBand(params.price);
  const featured = params.featured === "1" || params.featured === "true";

  const categoryParam = params.category?.trim();
  const subParam = params.sub?.trim();
  const domainParam = params.domain?.trim();
  const sellerParam = params.seller?.trim();
  const categoryId =
    categoryParam && UUID_RE.test(categoryParam) ? categoryParam : undefined;
  const subId = subParam && UUID_RE.test(subParam) ? subParam : undefined;
  const domainId =
    domainParam && UUID_RE.test(domainParam) ? domainParam : undefined;
  const sellerId =
    sellerParam && UUID_RE.test(sellerParam) ? sellerParam : undefined;

  const pageRaw = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const allCategories = await listSupplyCategoryOptions({ catalog: "material" });
  // A sub link without its group still works: derive the group from the sub.
  const subCategory = subId ? allCategories.find((c) => c.id === subId && c.parent_id) : undefined;
  const groupId = categoryId ?? subCategory?.parent_id ?? undefined;
  const childCats = groupId ? allCategories.filter((c) => c.parent_id === groupId) : [];

  const categoryFilter = subCategory
    ? { category_id: subCategory.id }
    : groupId && childCats.length > 0
      ? { category_parent_id: groupId }
      : groupId
        ? { category_id: groupId }
        : {};

  const [catalogResult, facets, tutorialArticles] = await Promise.all([
    listMaterialsCatalog({
      q,
      ...categoryFilter,
      domain_id: domainId,
      creator_id: sellerId,
      catalog_scope: MATERIALS_PAGE_SCOPE,
      price_min_cents: priceBand?.minCents,
      price_max_cents: priceBand?.maxCents,
      featured: featured || undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
    listMaterialsFacets({
      catalog_scope: MATERIALS_PAGE_SCOPE,
      group_id: groupId,
      sub_id: subCategory?.id,
      domain_id: domainId,
      creator_id: sellerId,
      price_min_cents: priceBand?.minCents,
      price_max_cents: priceBand?.maxCents,
      featured,
      q,
    }),
    listLatestArticles(3),
  ]);

  const { products, totalCount } = catalogResult;
  const productsWithPrices = await enrichPagePrices(products);
  const hasNextPage = offset + PAGE_SIZE < totalCount;

  const current: Record<string, string | undefined> = {
    q,
    category: groupId,
    sub: subCategory?.id,
    domain: domainId,
    seller: sellerId,
    price: priceBand?.key,
    featured: featured ? "1" : undefined,
    sort: sort === "recommended" ? undefined : sort,
  };
  const buildHref = (overrides: Record<string, string | undefined>) =>
    buildMaterialsHref(current, { page: undefined, ...overrides });
  const hrefForGroup = (id?: string) => buildHref({ category: id, sub: undefined });
  const hrefForSub = (id?: string) => buildHref({ sub: id });
  const hrefForPage = (target: number) =>
    buildMaterialsHref(current, { page: target > 1 ? String(target) : undefined });

  const facet = (name: MaterialsFacetCount["facet"]) =>
    facets
      .filter((row) => row.facet === name && row.n > 0)
      .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || b.n - a.n || (a.label ?? "").localeCompare(b.label ?? "", "nl-BE"));
  const groupRows = facet("group");
  const subRows = facet("sub");
  const groups = groupRows.map((row) => ({ id: row.value, label: row.label ?? "", n: row.n }));
  const activeGroupRow = groupId ? groupRows.find((row) => row.value === groupId) : undefined;
  const activeGroupCategory = groupId ? allCategories.find((c) => c.id === groupId) : undefined;
  const activeGroup = activeGroupCategory
    ? { id: activeGroupCategory.id, label: activeGroupCategory.name, n: activeGroupRow?.n ?? 0 }
    : null;
  const subs = subRows.map((row) => ({ id: row.value, label: row.label ?? "", n: row.n }));

  const filterGroups: FilterGroup[] = [
    {
      title: "Hobby",
      options: facet("domain").map((row) => ({
        value: row.value,
        label: row.label ?? "",
        n: row.n,
        active: row.value === domainId,
        href: buildHref({ domain: row.value === domainId ? undefined : row.value }),
      })),
    },
    {
      title: "Prijs",
      options: MATERIALS_PRICE_BAND_OPTIONS.flatMap((band) => {
        const row = facets.find((r) => r.facet === "price" && r.value === band.value);
        if (!row || row.n === 0) return [];
        const active = priceBand?.key === band.value;
        return [{ value: band.value, label: band.label, n: row.n, active, href: buildHref({ price: active ? undefined : band.value }) }];
      }),
    },
    {
      title: "Winkel",
      options: facet("seller")
        .sort((a, b) => b.n - a.n || (a.label ?? "").localeCompare(b.label ?? "", "nl-BE"))
        .map((row) => ({
          value: row.value,
          label: row.label ?? "",
          n: row.n,
          active: row.value === sellerId,
          href: buildHref({ seller: row.value === sellerId ? undefined : row.value }),
        })),
    },
  ].filter((group) => group.options.length > 1 || group.options.some((option) => option.active));
  const featuredRow = facets.find((row) => row.facet === "featured");

  const labelOf = (rows: MaterialsFacetCount[], id?: string) => rows.find((r) => r.value === id)?.label ?? undefined;
  const chips: FilterChip[] = [];
  if (q) chips.push({ label: `Zoek: ${q}`, removeHref: buildHref({ q: undefined }) });
  if (activeGroup) chips.push({ label: activeGroup.label, removeHref: buildHref({ category: undefined, sub: undefined }) });
  if (subCategory) chips.push({ label: subCategory.name, removeHref: buildHref({ sub: undefined }) });
  if (domainId) chips.push({ label: labelOf(facets.filter((r) => r.facet === "domain"), domainId) ?? "Hobby", removeHref: buildHref({ domain: undefined }) });
  if (sellerId) chips.push({ label: labelOf(facets.filter((r) => r.facet === "seller"), sellerId) ?? "Winkel", removeHref: buildHref({ seller: undefined }) });
  if (priceBand) {
    chips.push({
      label: MATERIALS_PRICE_BAND_OPTIONS.find((b) => b.value === priceBand.key)?.label ?? "Prijs",
      removeHref: buildHref({ price: undefined }),
    });
  }
  if (featured) chips.push({ label: "Uitgelicht", removeHref: buildHref({ featured: undefined }) });

  const workshops = domainId ? (await listWorkshopsByDomain(domainId)).slice(0, 4) : [];

  return (
    <>
      <MaterialsHero
        defaultQuery={params.q}
        hiddenFields={{
          category: groupId,
          sub: subCategory?.id,
          domain: domainId,
          seller: sellerId,
          price: priceBand?.key,
          featured: featured ? "1" : undefined,
          sort: sort === "recommended" ? undefined : sort,
        }}
      />

      <Container className="py-10 sm:py-12">
        <MaterialsCategoryBrowser
          groups={groups}
          subs={subs}
          activeGroup={activeGroup}
          activeSubId={subCategory?.id}
          hrefForGroup={hrefForGroup}
          hrefForSub={hrefForSub}
        />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <MaterialsFilterPanel
            groups={filterGroups}
            featured={
              featuredRow
                ? { n: featuredRow.n, active: featured, href: buildHref({ featured: featured ? undefined : "1" }) }
                : null
            }
            activeCount={chips.length}
            clearHref="/materials"
          />

          <div className="min-w-0 flex-1">
            <MaterialsCatalogToolbar totalCount={totalCount} activeSort={sort} buildHref={buildHref} />

            <ActiveFilterChips chips={chips} clearHref="/materials" />

            {productsWithPrices.length === 0 ? (
              <EmptyState
                title="Geen materialen gevonden"
                description="Pas je filters aan of bekijk alle materialen."
                action={{ label: "Alle materialen", href: "/materials" }}
              />
            ) : (
              <GridLayout cols={3} gap="lg">
                {productsWithPrices.map((product) => (
                  <MaterialsProductCard key={product.id} product={product} />
                ))}
              </GridLayout>
            )}

            <MaterialsPagination page={page} hasNextPage={hasNextPage} hrefForPage={hrefForPage} />

            <MaterialsAfterResults
              workshops={workshops}
              articles={tutorialArticles}
              workshopsHref={domainId ? `/workshops?domain=${domainId}` : "/workshops"}
            />
          </div>
        </div>
      </Container>
    </>
  );
}
