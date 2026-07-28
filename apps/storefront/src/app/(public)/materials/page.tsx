import type { Metadata } from "next";
import Link from "next/link";
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
  MATERIALS_SHORTCUTS,
  resolveCategoryChipIds,
  sanitizeAgendaSearchQuery,
} from "@/lib/materials/materials-catalog-helpers";
import { listLatestArticles } from "@/lib/platform/queries/articles";
import {
  listMaterialsCatalog,
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
    "Vind de juiste materialen voor je project — garen, klei, verf en meer",
};

type SearchParams = Promise<{
  q?: string;
  category?: string;
  sub?: string;
  offer?: string;
  condition?: string;
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
  const sort = params.sort === "newest" ? "newest" : "recommended";
  const condition = params.condition?.trim() || undefined;

  const categoryParam = params.category?.trim();
  const subParam = params.sub?.trim();
  const categoryId =
    categoryParam && UUID_RE.test(categoryParam) ? categoryParam : undefined;
  const subId = subParam && UUID_RE.test(subParam) ? subParam : undefined;

  const pageRaw = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const allCategories = await listSupplyCategoryOptions();
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
      offer,
      condition,
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
    offer,
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
    offer,
    condition,
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
  if (offer) {
    chips.push({
      label: OFFER_LABELS[offer] ?? offer,
      removeHref: buildMaterialsHref(current, {
        offer: undefined,
        page: undefined,
      }),
    });
  }
  if (condition) {
    chips.push({
      label: `Conditie: ${condition}`,
      removeHref: buildMaterialsHref(current, {
        condition: undefined,
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

  const showCondition = offer === "destash" || offer === "maker";

  const sidebarCategories = (
    navCategories.length > 0 ? navCategories : orderedRoots
  ).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <Container className="py-6">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]"
      >
        <Link href="/" className="transition-colors hover:text-[var(--accent)]">
          Hobbysalon
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-[var(--foreground)]">Materialen</span>
      </nav>

      <MaterialsHero
        defaultQuery={params.q}
        hiddenFields={{
          category: categoryId,
          sub: subId,
          offer,
          condition,
          sort: sort === "recommended" ? undefined : sort,
        }}
      />

      <MaterialsShortcutChips
        shortcuts={shortcuts}
        allHref={buildMaterialsHref(baseForShortcuts, {
          category: undefined,
          sub: undefined,
          page: undefined,
        })}
      />

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        <MaterialsCatalogSidebar
          categoryOptions={sidebarCategories}
          params={{
            q,
            category: categoryId,
            sub: subId,
            offer,
            condition,
            sort: sort === "recommended" ? undefined : sort,
          }}
          showCondition={showCondition}
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
            <GridLayout cols={4} gap="lg">
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
  );
}
