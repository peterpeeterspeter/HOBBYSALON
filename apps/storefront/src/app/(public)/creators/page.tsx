import type { Metadata } from "next";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { MaterialsCatalogToolbar } from "@/components/materials/MaterialsCatalogToolbar";
import { MaterialsPagination } from "@/components/materials/MaterialsPagination";
import { MaterialsProductCard } from "@/components/materials/MaterialsProductCard";
import { MaterialsShortcutChips } from "@/components/materials/MaterialsShortcutChips";
import { CreatorDiscoveryCard } from "@/components/creators/CreatorDiscoveryCard";
import { CreatorsAfterResults } from "@/components/creators/CreatorsAfterResults";
import { CreatorsHero } from "@/components/creators/CreatorsHero";
import { CreatorsMarketplaceSidebar } from "@/components/creators/CreatorsMarketplaceSidebar";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { GridLayout } from "@/components/layout/grid-layout";
import {
  MATERIALS_CONDITION_OPTIONS,
  MATERIALS_PRICE_BAND_OPTIONS,
  MATERIALS_SHORTCUTS,
  resolveCategoryChipIds,
  resolveMaterialsPriceBand,
  sanitizeAgendaSearchQuery,
} from "@/lib/materials/materials-catalog-helpers";
import { listCreatorsDirectory } from "@/lib/platform/queries/creators";
import {
  listMaterialsCatalog,
  listMaterialsDomainOptions,
  listMaterialsSellerOptions,
  listSupplyCategoryOptions,
  type MaterialsCatalogItem,
} from "@/lib/platform/queries/products";

export const metadata: Metadata = {
  title: "Makersmarkt | Hobbysalon",
  description:
    "Koop handgemaakte creaties en restanten rechtstreeks van makers op Hobbysalon",
};

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

const OFFER_LABELS: Record<string, string> = {
  maker: "Handgemaakt",
  destash: "Restanten / tweedehands",
};

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
  const offer =
    params.offer === "maker" || params.offer === "destash"
      ? params.offer
      : undefined;
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

  const [allCategories, sellerOptions, domainOptions] = await Promise.all([
    listSupplyCategoryOptions(),
    listMaterialsSellerOptions({ catalog_scope: "maker_p2p" }),
    listMaterialsDomainOptions({ catalog_scope: "maker_p2p" }),
  ]);
  const childCats = categoryId
    ? allCategories.filter((c) => c.parent_id === categoryId)
    : [];

  const categoryFilter =
    subId
      ? { category_id: subId }
      : categoryId && childCats.length > 0
        ? { category_parent_id: categoryId }
        : categoryId
          ? { category_id: categoryId }
          : {};

  const [catalogResult, makersDirectory] = await Promise.all([
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
    listCreatorsDirectory({
      domainId,
      sort: "recommended",
      limit: MAKERS_BELOW,
      offset: 0,
    }),
  ]);

  const { products, totalCount, categoryIdsWithSupply } = catalogResult;
  const hasNextPage = offset + PAGE_SIZE < totalCount;

  const rootCategories = allCategories.filter((c) => !c.parent_id);
  const orderedRoots =
    rootCategories.length > 0
      ? rootCategories
      : allCategories.filter(
          (c) => !allCategories.some((p) => p.id === c.parent_id)
        );

  const chipIds = resolveCategoryChipIds({
    categoryIdsWithSupply,
    selectedCategoryId: categoryId,
    allCategoryIdsOrdered: orderedRoots.map((c) => c.id),
  });
  const navCategories =
    chipIds.length > 0
      ? orderedRoots.filter((c) => chipIds.includes(c.id))
      : orderedRoots.slice(0, 12);

  const baseForShortcuts = {
    q,
    domain: domainId,
    seller: sellerId,
    offer,
    condition,
    price: priceBand?.key,
    featured: featured ? "1" : undefined,
    sort: sort === "recommended" ? undefined : sort,
  };

  const shortcuts = MATERIALS_SHORTCUTS.map((shortcut) => {
    const pool = [...navCategories, ...allCategories];
    const match = pool.find((cat) =>
      shortcut.nameIncludes.some((needle) =>
        cat.name.toLowerCase().includes(needle)
      )
    );
    if (!match) return null;
    return {
      label: shortcut.label,
      href: buildCreatorsHref(baseForShortcuts, {
        category: match.id,
        page: undefined,
      }),
      active: categoryId === match.id,
    };
  }).filter(Boolean) as Array<{
    label: string;
    href: string;
    active?: boolean;
  }>;

  const offerShortcuts = [
    {
      label: "Handgemaakt",
      href: buildCreatorsHref(baseForShortcuts, {
        offer: "maker",
        page: undefined,
      }),
      active: offer === "maker",
    },
    {
      label: "Restanten",
      href: buildCreatorsHref(baseForShortcuts, {
        offer: "destash",
        page: undefined,
      }),
      active: offer === "destash",
    },
  ];

  const current: Record<string, string | undefined> = {
    q,
    category: categoryId,
    sub: subId,
    domain: domainId,
    seller: sellerId,
    offer,
    condition,
    price: priceBand?.key,
    featured: featured ? "1" : undefined,
    sort: sort === "recommended" ? undefined : sort,
  };

  const buildHref = (overrides: Record<string, string | undefined>) =>
    buildCreatorsHref(current, overrides);

  const chips: FilterChip[] = [];
  if (q) {
    chips.push({
      label: `Zoek: ${q}`,
      removeHref: buildHref({ q: undefined, page: undefined }),
    });
  }
  if (categoryId) {
    chips.push({
      label:
        allCategories.find((c) => c.id === categoryId)?.name ?? "Categorie",
      removeHref: buildHref({
        category: undefined,
        sub: undefined,
        page: undefined,
      }),
    });
  }
  if (subId) {
    chips.push({
      label: allCategories.find((c) => c.id === subId)?.name ?? "Subcategorie",
      removeHref: buildHref({ sub: undefined, page: undefined }),
    });
  }
  if (domainId) {
    chips.push({
      label: domainOptions.find((d) => d.value === domainId)?.label ?? "Hobby",
      removeHref: buildHref({ domain: undefined, page: undefined }),
    });
  }
  if (sellerId) {
    chips.push({
      label: sellerOptions.find((s) => s.value === sellerId)?.label ?? "Maker",
      removeHref: buildHref({ seller: undefined, page: undefined }),
    });
  }
  if (offer) {
    chips.push({
      label: OFFER_LABELS[offer] ?? offer,
      removeHref: buildHref({ offer: undefined, page: undefined }),
    });
  }
  if (priceBand) {
    chips.push({
      label:
        MATERIALS_PRICE_BAND_OPTIONS.find((b) => b.value === priceBand.key)
          ?.label ?? "Prijs",
      removeHref: buildHref({ price: undefined, page: undefined }),
    });
  }
  if (condition) {
    chips.push({
      label:
        MATERIALS_CONDITION_OPTIONS.find((c) => c.value === condition)?.label ??
        condition,
      removeHref: buildHref({ condition: undefined, page: undefined }),
    });
  }
  if (featured) {
    chips.push({
      label: "Uitgelicht",
      removeHref: buildHref({ featured: undefined, page: undefined }),
    });
  }

  const sidebarCategories = (
    navCategories.length > 0 ? navCategories : orderedRoots
  ).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const makers = makersDirectory.creators;

  return (
    <>
      <CreatorsHero
        defaultQuery={q}
        hiddenFields={{
          category: categoryId,
          sub: subId,
          domain: domainId,
          seller: sellerId,
          offer,
          condition,
          price: priceBand?.key,
          featured: featured ? "1" : undefined,
          sort: sort === "recommended" ? undefined : sort,
        }}
      />

      <div className="border-b border-[var(--border)] bg-[var(--section-alt)]">
        <Container className="space-y-4 py-5 sm:py-6">
          <MaterialsShortcutChips
            shortcuts={offerShortcuts}
            allHref={buildCreatorsHref(baseForShortcuts, {
              offer: undefined,
              page: undefined,
            })}
            allLabel="Alles van makers"
          />
          <MaterialsShortcutChips
            shortcuts={shortcuts}
            allHref={buildCreatorsHref(baseForShortcuts, {
              category: undefined,
              sub: undefined,
              page: undefined,
            })}
          />
        </Container>
      </div>

      <Container className="py-6 sm:py-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
          <CreatorsMarketplaceSidebar
            categoryOptions={sidebarCategories}
            domainOptions={domainOptions}
            sellerOptions={sellerOptions}
            params={{
              q,
              category: categoryId,
              sub: subId,
              domain: domainId,
              seller: sellerId,
              offer,
              condition,
              price: priceBand?.key,
              featured: featured ? "1" : undefined,
              sort: sort === "recommended" ? undefined : sort,
            }}
          />

          <div className="min-w-0 flex-1">
            <MaterialsCatalogToolbar
              totalCount={totalCount}
              activeSort={sort}
              buildHref={buildHref}
            />

            <ActiveFilterChips chips={chips} clearHref="/creators" />

            {products.length === 0 ? (
              <EmptyState
                title="Geen creaties gevonden"
                description="Pas je filters aan of bekijk alles van makers."
                action={{ label: "Alles van makers", href: "/creators" }}
              />
            ) : (
              <GridLayout cols={3} gap="lg">
                {products.map((product: MaterialsCatalogItem) => (
                  <MaterialsProductCard key={product.id} product={product} />
                ))}
              </GridLayout>
            )}

            <MaterialsPagination
              page={page}
              hasNextPage={hasNextPage}
              hrefForPage={(target) =>
                buildHref({
                  page: target > 1 ? String(target) : undefined,
                })
              }
            />
          </div>
        </div>

        {makers.length > 0 ? (
          <section className="mt-14 border-t border-[var(--border)] pt-10">
            <div className="mb-6">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                Makers ontdekken
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
                Profielen van makers die workshops geven, creaties maken of
                materialen delen.
              </p>
            </div>
            <div
              id="makers"
              className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 snap-x snap-mandatory sm:-mx-6 sm:px-6 [scrollbar-width:thin]"
            >
              {makers.map((creator) => (
                <div
                  key={creator.id}
                  className="w-44 shrink-0 snap-start sm:w-52"
                >
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
