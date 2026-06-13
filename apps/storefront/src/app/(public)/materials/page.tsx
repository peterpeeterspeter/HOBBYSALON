import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard, ProductCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Container } from "@/components/ui/container";
import { MaterialsSidebar } from "@/components/materials/MaterialsSidebar";
import { CategoryCircles } from "@/components/materials/CategoryCircles";
import {
  ActiveFilterChips,
  type FilterChip,
} from "@/components/materials/ActiveFilterChips";
import { MaterialsToolbar } from "@/components/materials/MaterialsToolbar";
import { MaterialProductRow } from "@/components/materials/MaterialProductRow";
import { MaterialsPagination } from "@/components/materials/MaterialsPagination";
import { getLocationPreference } from "@/lib/location/preference";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { listWorkshopsByDomain } from "@/lib/platform/queries/workshops";
import { listLatestArticles } from "@/lib/platform/queries/articles";
import {
  listSupplyCategoryOptions,
  listSupplyMarketplaceProducts,
  type SupplyMarketplaceProduct,
} from "@/lib/platform/queries/products";
import {
  getMedusaProduct,
  getMedusaProductByHandle,
} from "@/lib/commerce/medusa/products";

export const metadata: Metadata = {
  title: "Hobbymaterialen | Hobbysalon",
  description: "Ontdek materialen van makers en handelaars op Hobbysalon.",
};

type SearchParams = Promise<{
  q?: string;
  domain?: string;
  category?: string;
  creator_type?: string;
  sort?: string;
  page?: string;
  view?: string;
}>;

const MATERIAL_CATEGORY_FILTERS = [
  "Textiel & Handwerken",
  "Tekenen & Kleuren",
  "Stickers & Tapes",
  "Schilderen",
  "Knutselpakketten",
  "Sieraden maken",
  "Hobbygereedschap",
  "Home deco",
  "Modelbouw & Miniaturen",
  "Papier & Karton",
  "Diamond Painting & accessoires",
  "Schrijven & Handlettering",
  "Stempelen",
  "Modelspoor",
  "Boetseren",
  "Pixelen & Strijkkralen",
  "Leerbewerking",
  "Gieten",
  "Houtbewerking",
  "Embossing & Plotten",
  "Inkt",
  "Slijm",
  "Speelzand",
  "Metaalbewerking",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProductWithPrice = SupplyMarketplaceProduct & {
  price?: { amount: number; currency_code: string } | null;
};

const PAGE_SIZE = 24;

async function enrichProductsWithPrices(
  products: SupplyMarketplaceProduct[]
): Promise<ProductWithPrice[]> {
  const rows = await Promise.all(
    products.map(async (product) => {
      const medusaById = await getMedusaProduct(product.medusa_product_id);
      const medusa = medusaById ?? (await getMedusaProductByHandle(product.slug));
      const price = medusa?.calculated_price
        ? {
            amount: medusa.calculated_price.calculated_amount,
            currency_code: medusa.calculated_price.currency_code,
          }
        : null;
      return {
        ...product,
        medusa_product_id: product.medusa_product_id ?? medusa?.id ?? null,
        price,
      };
    })
  );
  return rows.filter((row) => !!row.medusa_product_id);
}

function sortProducts(products: ProductWithPrice[], sort: string) {
  if (sort === "newest") {
    return [...products].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return products;
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
  const creatorTypeFilter =
    params.creator_type && params.creator_type !== "all"
      ? params.creator_type
      : undefined;
  const categoryFilter = params.category?.trim() ? params.category.trim() : undefined;
  const categoryIdFilter =
    categoryFilter && UUID_RE.test(categoryFilter) ? categoryFilter : undefined;
  const categoryNameFilter = categoryIdFilter ? undefined : categoryFilter;
  const pageRaw = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const view = params.view === "list" ? "list" : "grid";
  const sort = params.sort === "newest" ? "newest" : "relevance";
  const locationPreference = await getLocationPreference();

  const [domains, categoryOptions, supplyProducts, tutorialArticles] =
    await Promise.all([
      listActiveDomains(),
      listSupplyCategoryOptions({ domain_id: params.domain || undefined }),
      listSupplyMarketplaceProducts({
        q: params.q,
        domain_id: params.domain,
        category_id: categoryIdFilter,
        category_name: categoryNameFilter,
        creator_type: creatorTypeFilter,
        preferred_city: locationPreference.city ?? undefined,
        preferred_country_code: locationPreference.countryCode ?? undefined,
        limit: PAGE_SIZE + 1,
        offset,
      }),
      listLatestArticles(3),
    ]);

  const hasNextPage = supplyProducts.length > PAGE_SIZE;
  const pagedProducts = hasNextPage
    ? supplyProducts.slice(0, PAGE_SIZE)
    : supplyProducts;
  const productsWithPrices = sortProducts(
    await enrichProductsWithPrices(pagedProducts),
    sort
  );

  // Graph: workshops that teach with materials in the selected domain.
  const graphWorkshops = params.domain
    ? (await listWorkshopsByDomain(params.domain)).slice(0, 4)
    : [];

  const categorySelectOptions = [
    ...MATERIAL_CATEGORY_FILTERS.map((name) => ({ value: name, label: name })),
    ...categoryOptions
      .filter(
        (category) =>
          !MATERIAL_CATEGORY_FILTERS.some(
            (name) => name.toLowerCase() === category.name.toLowerCase()
          )
      )
      .map((category) => ({ value: category.id, label: category.name })),
  ];

  const current = {
    q: params.q,
    domain: params.domain,
    category: params.category,
    creator_type: creatorTypeFilter,
    sort: params.sort,
    view: params.view,
  };

  const hrefForDomain = (domainId?: string) =>
    buildMaterialsHref(current, { domain: domainId, page: undefined });
  const hrefForPage = (target: number) =>
    buildMaterialsHref(current, { page: target > 1 ? String(target) : undefined });

  const chips: FilterChip[] = [];
  if (params.q) {
    chips.push({
      label: `"${params.q}"`,
      removeHref: buildMaterialsHref(current, { q: undefined, page: undefined }),
    });
  }
  if (params.domain) {
    chips.push({
      label: domains.find((d) => d.id === params.domain)?.name ?? "Domein",
      removeHref: buildMaterialsHref(current, { domain: undefined, page: undefined }),
    });
  }
  if (categoryFilter) {
    chips.push({
      label:
        categoryNameFilter ??
        categoryOptions.find((c) => c.id === categoryFilter)?.name ??
        "Categorie",
      removeHref: buildMaterialsHref(current, { category: undefined, page: undefined }),
    });
  }
  if (creatorTypeFilter) {
    chips.push({
      label:
        creatorTypeFilter === "supplier"
          ? "Leveranciers"
          : creatorTypeFilter === "maker"
            ? "Makers"
            : creatorTypeFilter,
      removeHref: buildMaterialsHref(current, {
        creator_type: undefined,
        page: undefined,
      }),
    });
  }

  const activeCategoryLabel = categoryFilter
    ? (categoryNameFilter ??
        categoryOptions.find((c) => c.id === categoryFilter)?.name ??
        "Categorie")
    : null;

  return (
    <Container className="py-6">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]"
      >
        <Link href="/" className="transition-colors hover:text-[var(--accent)]">
          Hobbysalon
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-[var(--foreground)]">Hobbymaterialen</span>
        {activeCategoryLabel && (
          <>
            <span aria-hidden>›</span>
            <span className="font-semibold text-[var(--foreground)]">
              {activeCategoryLabel}
            </span>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        <MaterialsSidebar
          domains={domains}
          categoryOptions={categorySelectOptions}
          params={{
            q: params.q,
            domain: params.domain,
            category: params.category,
            creator_type: params.creator_type,
            sort: params.sort,
            view: params.view,
          }}
        />

        <div className="min-w-0 flex-1">
          {/* Page header — inside the main column, beside the sidebar (per design) */}
          <header className="mb-5">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
              {activeCategoryLabel ?? "Hobbymaterialen"}
            </h1>
            <p className="mt-1 text-[15px] text-[var(--muted)]">
              Materialen van makers en leveranciers — direct bestellen, snel in huis.
            </p>
            {locationPreference.hasPreference && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--card)] px-3 py-1 text-sm text-[var(--foreground)]">
                  Lokale prioriteit: {locationPreference.label}
                </span>
                <Link
                  href="/materials"
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Reset filters
                </Link>
              </div>
            )}
          </header>

          <CategoryCircles
            domains={domains}
            activeDomain={params.domain}
            hrefForDomain={hrefForDomain}
          />

          <ActiveFilterChips chips={chips} clearHref="/materials" />

          {graphWorkshops.length > 0 && (
            <section className="mb-6 rounded-[10px] border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[var(--accent)]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                  Workshops
                </span>
                <span className="text-[15px] font-semibold text-[var(--foreground)]">
                  Leer deze technieken in een workshop:
                </span>
                <div className="flex flex-wrap gap-2">
                  {graphWorkshops.map((workshop) => (
                    <Link
                      key={workshop.id}
                      href={`/workshop/${workshop.slug}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      {workshop.featured_image_url && (
                        <img
                          src={workshop.featured_image_url}
                          alt=""
                          className="h-7 w-7 rounded object-cover"
                          loading="lazy"
                        />
                      )}
                      <span className="max-w-[200px] truncate">{workshop.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          <MaterialsToolbar resultCount={productsWithPrices.length} view={view} />

          {productsWithPrices.length === 0 ? (
            <EmptyState
              title="Geen materialen gevonden"
              description="Pas je filters aan of probeer een bredere zoekterm."
              action={{ label: "Alle materialen", href: "/materials" }}
            />
          ) : view === "list" ? (
            <div className="flex flex-col gap-4">
              {productsWithPrices.map((product) => (
                <MaterialProductRow key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <GridLayout cols={4} gap="lg">
              {productsWithPrices.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </GridLayout>
          )}

          <MaterialsPagination
            page={page}
            hasNextPage={hasNextPage}
            hrefForPage={hrefForPage}
          />

          {tutorialArticles.length > 0 && (
            <section className="mt-12 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-full bg-[var(--accent)]/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                  Artikelen
                </span>
                <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
                  Tutorials met deze materialen
                </h2>
                <span className="hidden h-px flex-1 bg-[var(--border)] sm:block" />
                <Link
                  href="/gratis-haakpatronen"
                  className="text-sm font-semibold text-[var(--accent)] hover:underline"
                >
                  Alle tutorials →
                </Link>
              </div>
              <GridLayout cols={3} gap="md">
                {tutorialArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </GridLayout>
            </section>
          )}
        </div>
      </div>
    </Container>
  );
}
