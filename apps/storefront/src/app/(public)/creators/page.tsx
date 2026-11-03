import type { Metadata } from "next";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { MaterialsCatalogToolbar } from "@/components/materials/MaterialsCatalogToolbar";
import { MaterialsPagination } from "@/components/materials/MaterialsPagination";
import { MaterialsFilterPanel, type FilterGroup } from "@/components/materials/MaterialsFilterPanel";
import { DestashListingRow, HandmadeListingCard } from "@/components/creators/MakerListingCards";
import { MakerMarketTabs } from "@/components/creators/MakerMarketTabs";
import { CreatorDiscoveryCard } from "@/components/creators/CreatorDiscoveryCard";
import { CreatorsAfterResults } from "@/components/creators/CreatorsAfterResults";
import { CreatorsHero } from "@/components/creators/CreatorsHero";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MATERIALS_CONDITION_OPTIONS,
  MATERIALS_PRICE_BAND_OPTIONS,
  resolveMaterialsPriceBand,
  sanitizeAgendaSearchQuery,
} from "@/lib/materials/materials-catalog-helpers";
import { listCreatorsDirectory } from "@/lib/platform/queries/creators";
import {
  listMakerMarketFacets,
  listMaterialsCatalog,
  type MakerMarketFacetCount,
  type MaterialsCatalogItem,
} from "@/lib/platform/queries/products";
import { pickMakerProductListingHero } from "@/lib/platform/queries/listing-featured-hero";
import { buildRegionalPageMetadata } from "@/lib/markets/regional-seo";
import { getRequestMarket } from "@/lib/markets/request";
import { marketSeoDecision } from "@/lib/markets/seo-policy";

export async function generateMetadata(): Promise<Metadata> {
  const resolution = await getRequestMarket();
  return buildRegionalPageMetadata({
    path: "/creators",
    decision: marketSeoDecision(resolution),
  });
}

type SearchParams = Promise<{
  q?: string;
  category?: string;
  sub?: string;
  domain?: string;
  seller?: string;
  offer?: string;
  condition?: string;
  price?: string;
  featured?: string;
  sort?: string;
  page?: string;
}>;

const PAGE_SIZE = 24;
const MAKERS_BELOW = 8;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildCreatorsHref(
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
  return serialized ? `/creators?${serialized}` : "/creators";
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = sanitizeAgendaSearchQuery(params.q) ?? undefined;
  // Zelfgemaakt is the default tab; overschot is the second.
  const offer: "maker" | "destash" = params.offer === "destash" ? "destash" : "maker";
  const productType = offer === "destash" ? "destash" : "handmade";
  const sort =
    params.sort === "newest" ||
    params.sort === "price_asc" ||
    params.sort === "price_desc"
      ? params.sort
      : "recommended";
  const conditionRaw = params.condition?.trim();
  const condition = MATERIALS_CONDITION_OPTIONS.some(
    (option) => option.value === conditionRaw
  )
    ? conditionRaw
    : undefined;
  const priceBand = resolveMaterialsPriceBand(params.price);
  const featured = params.featured === "1" || params.featured === "true";

  const categoryParam = params.category?.trim();
  const domainParam = params.domain?.trim();
  const sellerParam = params.seller?.trim();
  const categoryId =
    categoryParam && UUID_RE.test(categoryParam) ? categoryParam : undefined;
  const domainId =
    domainParam && UUID_RE.test(domainParam) ? domainParam : undefined;
  const sellerId =
    sellerParam && UUID_RE.test(sellerParam) ? sellerParam : undefined;

  const pageRaw = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const categoryFilter = categoryId ? { category_id: categoryId } : {};
  const [catalogResult, facets, makersDirectory, featuredHero] = await Promise.all([
    listMaterialsCatalog({
      q,
      ...categoryFilter,
      domain_id: domainId,
      creator_id: sellerId,
      catalog_scope: "maker_p2p",
      offer,
      condition,
      price_min_cents: priceBand?.minCents,
      price_max_cents: priceBand?.maxCents,
      featured: featured || undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
    listMakerMarketFacets({
      product_type: productType,
      domain_id: domainId,
      category_id: categoryId,
      creator_id: sellerId,
      price_min_cents: priceBand?.minCents,
      price_max_cents: priceBand?.maxCents,
      condition,
      featured,
      q,
    }),
    listCreatorsDirectory({ domainId, sort: "recommended", limit: MAKERS_BELOW, offset: 0 }),
    pickMakerProductListingHero(),
  ]);

  const { products, totalCount } = catalogResult;
  const hasNextPage = offset + PAGE_SIZE < totalCount;

  const current: Record<string, string | undefined> = {
    q,
    category: categoryId,
    domain: domainId,
    seller: sellerId,
    offer: offer === "destash" ? "destash" : undefined,
    condition,
    price: priceBand?.key,
    featured: featured ? "1" : undefined,
    sort: sort === "recommended" ? undefined : sort,
  };
  const buildHref = (overrides: Record<string, string | undefined>) =>
    buildCreatorsHref(current, { page: undefined, ...overrides });

  const rows = (name: MakerMarketFacetCount["facet"]) =>
    facets
      .filter((row) => row.facet === name && row.n > 0)
      .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || b.n - a.n || (a.label ?? "").localeCompare(b.label ?? "", "nl-BE"));
  const typeCount = (type: string) => facets.find((row) => row.facet === "type" && row.value === type)?.n ?? 0;
  const option = (row: MakerMarketFacetCount, param: string, active: boolean, label?: string) => ({
    value: row.value,
    label: label ?? row.label ?? row.value,
    n: row.n,
    active,
    href: buildHref({ [param]: active ? undefined : row.value, ...(param === "domain" ? { category: undefined } : {}) }),
  });

  const filterGroups: FilterGroup[] = [
    { title: "Hobby", options: rows("domain").map((row) => option(row, "domain", row.value === domainId)) },
    // Category names repeat per hobby, so they only show inside one hobby.
    ...(domainId ? [{ title: "Soort", options: rows("category").map((row) => option(row, "category", row.value === categoryId)) }] : []),
    {
      title: "Prijs",
      options: MATERIALS_PRICE_BAND_OPTIONS.flatMap((band) => {
        const row = facets.find((r) => r.facet === "price" && r.value === band.value);
        return row && row.n > 0 ? [option(row, "price", priceBand?.key === band.value, band.label)] : [];
      }),
    },
    ...(offer === "destash"
      ? [{
          title: "Staat",
          options: rows("condition").map((row) =>
            option(row, "condition", row.value === condition, MATERIALS_CONDITION_OPTIONS.find((c) => c.value === row.value)?.label)),
        }]
      : []),
    {
      title: "Maker",
      options: rows("seller")
        .sort((a, b) => b.n - a.n || (a.label ?? "").localeCompare(b.label ?? "", "nl-BE"))
        .map((row) => option(row, "seller", row.value === sellerId)),
    },
  ].filter((group) => group.options.length > 1 || group.options.some((o) => o.active));
  const featuredRow = facets.find((row) => row.facet === "featured");

  const labelOf = (name: MakerMarketFacetCount["facet"], id?: string) =>
    facets.find((row) => row.facet === name && row.value === id)?.label ?? undefined;
  const chips: FilterChip[] = [];
  if (q) chips.push({ label: `Zoek: ${q}`, removeHref: buildHref({ q: undefined }) });
  if (domainId) chips.push({ label: labelOf("domain", domainId) ?? "Hobby", removeHref: buildHref({ domain: undefined, category: undefined }) });
  if (categoryId) chips.push({ label: labelOf("category", categoryId) ?? "Soort", removeHref: buildHref({ category: undefined }) });
  if (sellerId) chips.push({ label: labelOf("seller", sellerId) ?? "Maker", removeHref: buildHref({ seller: undefined }) });
  if (priceBand) chips.push({ label: MATERIALS_PRICE_BAND_OPTIONS.find((b) => b.value === priceBand.key)?.label ?? "Prijs", removeHref: buildHref({ price: undefined }) });
  if (condition) chips.push({ label: MATERIALS_CONDITION_OPTIONS.find((c) => c.value === condition)?.label ?? condition, removeHref: buildHref({ condition: undefined }) });
  if (featured) chips.push({ label: "Uitgelicht", removeHref: buildHref({ featured: undefined }) });

  const tabHref = (key: "maker" | "destash") =>
    buildCreatorsHref({ q, domain: domainId, sort: current.sort }, { offer: key === "destash" ? "destash" : undefined });
  const tabs = [
    { key: "maker" as const, label: "Zelfgemaakt", description: "Uniek werk, rechtstreeks van de maker", n: typeCount("handmade"), href: tabHref("maker"), active: offer === "maker" },
    { key: "destash" as const, label: "Overschot", description: "Materiaal dat makers niet meer gebruiken", n: typeCount("destash"), href: tabHref("destash"), active: offer === "destash" },
  ];
  const noun = offer === "destash" ? (totalCount === 1 ? "overschot" : "overschotten") : totalCount === 1 ? "creatie" : "creaties";
  const makers = makersDirectory.creators;

  return (
    <>
      <CreatorsHero
        featured={featuredHero}
        defaultQuery={q}
        hiddenFields={{
          category: categoryId,
          domain: domainId,
          seller: sellerId,
          offer: current.offer,
          condition,
          price: priceBand?.key,
          featured: featured ? "1" : undefined,
          sort: current.sort,
        }}
      />

      <Container className="py-10 sm:py-12">
        <MakerMarketTabs tabs={tabs} />

        <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start">
          <MaterialsFilterPanel
            groups={filterGroups}
            featured={featuredRow ? { n: featuredRow.n, active: featured, href: buildHref({ featured: featured ? undefined : "1" }) } : null}
            activeCount={chips.length}
            clearHref={tabHref(offer)}
          />

          <div className="min-w-0 flex-1">
            <MaterialsCatalogToolbar
              totalCount={totalCount}
              activeSort={sort}
              buildHref={buildHref}
              countLabel={`${totalCount} ${noun}`}
            />
            <ActiveFilterChips chips={chips} clearHref={tabHref(offer)} />

            {products.length === 0 ? (
              <EmptyState
                title={offer === "destash" ? "Geen overschot gevonden" : "Geen creaties gevonden"}
                description="Pas je filters aan of bekijk alles."
                action={{ label: "Toon alles", href: tabHref(offer) }}
              />
            ) : offer === "destash" ? (
              <ul className="flex flex-col gap-3">
                {products.map((product: MaterialsCatalogItem) => (
                  <li key={product.id}>
                    <DestashListingRow product={product} />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3">
                {products.map((product: MaterialsCatalogItem) => (
                  <li key={product.id}>
                    <HandmadeListingCard product={product} />
                  </li>
                ))}
              </ul>
            )}

            <MaterialsPagination
              page={page}
              hasNextPage={hasNextPage}
              hrefForPage={(target) => buildCreatorsHref(current, { page: target > 1 ? String(target) : undefined })}
            />
          </div>
        </div>

        {makers.length > 0 ? (
          <section className="mt-16 border-t border-[var(--border)] pt-12">
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">
              Makers ontdekken
            </h2>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
              Profielen van makers die creaties maken, workshops geven of materiaal delen.
            </p>
            <div
              id="makers"
              className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-1 snap-x snap-mandatory sm:-mx-6 sm:px-6 [scrollbar-width:thin]"
            >
              {makers.map((creator) => (
                <div key={creator.id} className="w-44 shrink-0 snap-start sm:w-52">
                  <CreatorDiscoveryCard creator={creator} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <CreatorsAfterResults />
      </Container>
    </>
  );
}
