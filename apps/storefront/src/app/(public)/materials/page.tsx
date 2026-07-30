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
import { MaterialsShortcutChips } from "@/components/materials/MaterialsShortcutChips";
import { MaterialsCategoryNav } from "@/components/materials/MaterialsCategoryNav";
import { MaterialsCatalogSidebar } from "@/components/materials/MaterialsCatalogSidebar";
import { MaterialsCatalogToolbar } from "@/components/materials/MaterialsCatalogToolbar";
import { MaterialsProductCard } from "@/components/materials/MaterialsProductCard";
import { MaterialsAfterResults } from "@/components/materials/MaterialsAfterResults";
import {
  MATERIALS_CONDITION_OPTIONS,
  MATERIALS_PRICE_BAND_OPTIONS,
  MATERIALS_SHORTCUTS,
  parseMaterialsBuyMode,
  resolveCategoryChipIds,
  resolveMaterialsPriceBand,
  sanitizeAgendaSearchQuery,
} from "@/lib/materials/materials-catalog-helpers";
import { listLatestArticles } from "@/lib/platform/queries/articles";
import {
  listMaterialsCatalog,
  listMaterialsDomainOptions,
  listMaterialsSellerOptions,
  listSupplyCategoryOptions,
  type MaterialsCatalogItem,
} from "@/lib/platform/queries/products";
import { listWorkshopsByDomain } from "@/lib/platform/queries/workshops";
import {
  getMedusaProduct,
  getMedusaProductByHandle,
} from "@/lib/commerce/medusa/products";

export const metadata: Metadata = {
  title: "Hobbymaterialen | Hobbysalon",
  description:
    "Vind de juiste materialen voor je project: garen, klei, verf en meer",
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
  buy?: string;
  featured?: string;
  sort?: string;
  page?: string;
}>;

const PAGE_SIZE = 24;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OFFER_LABELS: Record<string, string> = {
  webshop: "Webshop",
  maker: "Maker",
  destash: "Tweedehands",
  kit: "Workshoppakket",
};

const BUY_LABELS: Record<string, string> = {
  online: "Direct te kopen",
  contact: "Via maker vragen",
};

const SORT_VALUES = ["recommended", "newest", "price_asc", "price_desc"] as const;
type MaterialsSort = (typeof SORT_VALUES)[number];

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
      if (!amount || amount <= 0) return product;
      return {
        ...product,
        displayPrice: {
          amount,
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
  const offer =
    params.offer === "webshop" ||
    params.offer === "maker" ||
    params.offer === "destash" ||
    params.offer === "kit"
      ? params.offer
      : undefined;
  const sort = parseSort(params.sort);
  const conditionRaw = params.condition?.trim();
  const condition = MATERIALS_CONDITION_OPTIONS.some(
    (option) => option.value === conditionRaw
  )
    ? conditionRaw
    : undefined;
  const priceBand = resolveMaterialsPriceBand(params.price);
  const buy = parseMaterialsBuyMode(params.buy);
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
    listMaterialsSellerOptions(),
    listMaterialsDomainOptions(),
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

  const [catalogResult, tutorialArticles] = await Promise.all([
    listMaterialsCatalog({
      q,
      ...categoryFilter,
      domain_id: domainId,
      creator_id: sellerId,
      offer,
      condition,
      price_min_cents: priceBand?.minCents,
      price_max_cents: priceBand?.maxCents,
      buy,
      featured: featured || undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
    listLatestArticles(3),
  ]);

  const { products, totalCount, categoryIdsWithSupply } = catalogResult;
  const productsWithPrices = await enrichPagePrices(products);
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
    buy,
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
      href: buildMaterialsHref(baseForShortcuts, {
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

  const current: Record<string, string | undefined> = {
    q,
    category: categoryId,
    sub: subId,
    domain: domainId,
    seller: sellerId,
    offer,
    condition,
    price: priceBand?.key,
    buy,
    featured: featured ? "1" : undefined,
    sort: sort === "recommended" ? undefined : sort,
  };

  const buildHref = (overrides: Record<string, string | undefined>) =>
    buildMaterialsHref(current, overrides);
  const hrefForCategory = (id?: string) =>
    buildMaterialsHref(current, {
      category: id,
      sub: undefined,
      page: undefined,
    });
  const hrefForSub = (id?: string) =>
    buildMaterialsHref(current, { sub: id, page: undefined });
  const hrefForPage = (target: number) =>
    buildMaterialsHref(current, {
      page: target > 1 ? String(target) : undefined,
    });

  const chips: FilterChip[] = [];
  if (q) {
    chips.push({
      label: `Zoek: ${q}`,
      removeHref: buildMaterialsHref(current, { q: undefined, page: undefined }),
    });
  }
  if (categoryId) {
    chips.push({
      label:
        allCategories.find((c) => c.id === categoryId)?.name ?? "Categorie",
      removeHref: buildMaterialsHref(current, {
        category: undefined,
        sub: undefined,
        page: undefined,
      }),
    });
  }
  if (subId) {
    chips.push({
      label: allCategories.find((c) => c.id === subId)?.name ?? "Subcategorie",
      removeHref: buildMaterialsHref(current, {
        sub: undefined,
        page: undefined,
      }),
    });
  }
  if (domainId) {
    chips.push({
      label:
        domainOptions.find((d) => d.value === domainId)?.label ?? "Hobby",
      removeHref: buildMaterialsHref(current, {
        domain: undefined,
        page: undefined,
      }),
    });
  }
  if (sellerId) {
    chips.push({
      label:
        sellerOptions.find((s) => s.value === sellerId)?.label ?? "Verkoper",
      removeHref: buildMaterialsHref(current, {
        seller: undefined,
        page: undefined,
      }),
    });
  }
  if (offer) {
    chips.push({
      label: OFFER_LABELS[offer] ?? offer,
      removeHref: buildMaterialsHref(current, {
        offer: undefined,
        page: undefined,
      }),
    });
  }
  if (priceBand) {
    chips.push({
      label:
        MATERIALS_PRICE_BAND_OPTIONS.find((b) => b.value === priceBand.key)
          ?.label ?? "Prijs",
      removeHref: buildMaterialsHref(current, {
        price: undefined,
        page: undefined,
      }),
    });
  }
  if (condition) {
    chips.push({
      label:
        MATERIALS_CONDITION_OPTIONS.find((c) => c.value === condition)?.label ??
        condition,
      removeHref: buildMaterialsHref(current, {
        condition: undefined,
        page: undefined,
      }),
    });
  }
  if (buy) {
    chips.push({
      label: BUY_LABELS[buy] ?? buy,
      removeHref: buildMaterialsHref(current, {
        buy: undefined,
        page: undefined,
      }),
    });
  }
  if (featured) {
    chips.push({
      label: "Uitgelicht",
      removeHref: buildMaterialsHref(current, {
        featured: undefined,
        page: undefined,
      }),
    });
  }

  const activeCategory = allCategories.find(
    (c) => c.id === (subId ?? categoryId)
  );
  const workshops = activeCategory?.domain_id
    ? (await listWorkshopsByDomain(activeCategory.domain_id)).slice(0, 4)
    : [];

  const sidebarCategories = (
    navCategories.length > 0 ? navCategories : orderedRoots
  ).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <>
      <MaterialsHero
        defaultQuery={params.q}
        hiddenFields={{
          category: categoryId,
          sub: subId,
          domain: domainId,
          seller: sellerId,
          offer,
          condition,
          price: priceBand?.key,
          buy,
          featured: featured ? "1" : undefined,
          sort: sort === "recommended" ? undefined : sort,
        }}
      />

      <div className="border-b border-[var(--border)] bg-[var(--section-alt)]">
        <Container className="py-5 sm:py-6">
          <MaterialsShortcutChips
            shortcuts={shortcuts}
            allHref={buildMaterialsHref(baseForShortcuts, {
              category: undefined,
              sub: undefined,
              page: undefined,
            })}
          />
        </Container>
      </div>

      <Container className="py-6 sm:py-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
          <MaterialsCatalogSidebar
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
              buy,
              featured: featured ? "1" : undefined,
              sort: sort === "recommended" ? undefined : sort,
            }}
          />

          <div className="min-w-0 flex-1">
            <MaterialsCategoryNav
              categories={navCategories}
              activeCategoryId={categoryId}
              hrefForCategory={hrefForCategory}
              subcategories={childCats}
              activeSubId={subId}
              hrefForSub={hrefForSub}
            />

            <MaterialsCatalogToolbar
              totalCount={totalCount}
              activeSort={sort}
              buildHref={buildHref}
            />

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

            <MaterialsPagination
              page={page}
              hasNextPage={hasNextPage}
              hrefForPage={hrefForPage}
            />

            <MaterialsAfterResults
              workshops={workshops}
              articles={tutorialArticles}
              workshopsHref={
                activeCategory?.domain_id
                  ? `/workshops?domain=${activeCategory.domain_id}`
                  : "/workshops"
              }
            />
          </div>
        </div>
      </Container>
    </>
  );
}
