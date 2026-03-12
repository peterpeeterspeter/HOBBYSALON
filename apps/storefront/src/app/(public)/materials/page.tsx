import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CardShell } from "@/components/ui/card-shell";
import { Container } from "@/components/ui/container";
import { getLocationPreference } from "@/lib/location/preference";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import {
  listSupplyCategoryOptions,
  listSupplyMarketplaceProducts,
  type SupplyMarketplaceProduct,
} from "@/lib/platform/queries/products";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";

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

type ProductWithPrice = SupplyMarketplaceProduct & {
  price?: { amount: number; currency_code: string } | null;
};

const PAGE_SIZE = 24;

async function enrichProductsWithPrices(
  products: SupplyMarketplaceProduct[]
): Promise<ProductWithPrice[]> {
  return Promise.all(
    products.map(async (product) => {
      const medusa = await getMedusaProduct(product.medusa_product_id);
      const price = medusa?.calculated_price
        ? {
            amount: medusa.calculated_price.calculated_amount,
            currency_code: medusa.calculated_price.currency_code,
          }
        : null;
      return { ...product, price };
    })
  );
}

function sortProducts(products: ProductWithPrice[], sort: string | undefined) {
  if (sort === "newest") {
    return [...products].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return products;
}

function buildMaterialsHref(
  base: Record<string, string | undefined>,
  nextPage: number
) {
  const query = new URLSearchParams();
  Object.entries(base).forEach(([key, value]) => {
    if (value && value.trim()) {
      query.set(key, value);
    }
  });
  if (nextPage > 1) {
    query.set("page", String(nextPage));
  }
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
    categoryFilter &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      categoryFilter
    )
      ? categoryFilter
      : undefined;
  const categoryNameFilter = categoryIdFilter ? undefined : categoryFilter;
  const pageRaw = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const locationPreference = await getLocationPreference();
  const [domains, categoryOptions, supplyProducts] = await Promise.all([
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
  ]);

  const hasNextPage = supplyProducts.length > PAGE_SIZE;
  const pagedProducts = hasNextPage ? supplyProducts.slice(0, PAGE_SIZE) : supplyProducts;
  const productsWithPrices = sortProducts(
    await enrichProductsWithPrices(pagedProducts),
    params.sort
  );
  const baseQuery = {
    q: params.q,
    domain: params.domain,
    category: params.category,
    creator_type: params.creator_type,
    sort: params.sort,
  };

  return (
    <Container className="py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
          Hobbymaterialen
        </h1>
        <p className="text-lg text-[var(--muted)]">
          Materialen van makers en handelaars op het platform.
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

      <CardShell variant="default" padding="lg" className="mb-8">
        <h2 className="font-semibold text-[var(--foreground)] mb-4">Filters</h2>
        <form method="GET" action="/materials" className="grid gap-4 sm:grid-cols-6">
          <Input
            id="q"
            name="q"
            label="Zoekterm"
            placeholder="garen, naalden, verf..."
            defaultValue={params.q ?? ""}
          />
          <Select
            id="domain"
            name="domain"
            label="Domein"
            placeholder="Alle domeinen"
            options={domains.map((domain) => ({
              value: domain.id,
              label: domain.name,
            }))}
            defaultValue={params.domain ?? ""}
          />
          <Select
            id="category"
            name="category"
            label="Categorie"
            placeholder="Alle categorieen"
            options={[
              ...MATERIAL_CATEGORY_FILTERS.map((name) => ({ value: name, label: name })),
              ...categoryOptions
                .filter(
                  (category) =>
                    !MATERIAL_CATEGORY_FILTERS.some(
                      (name) => name.toLowerCase() === category.name.toLowerCase()
                    )
                )
                .map((category) => ({ value: category.id, label: category.name })),
            ]}
            defaultValue={params.category ?? ""}
          />
          <Select
            id="creator_type"
            name="creator_type"
            label="Aanbieder"
            options={[
              { value: "all", label: "Iedereen" },
              { value: "supplier", label: "Leveranciers" },
              { value: "maker", label: "Makers" },
            ]}
            defaultValue={params.creator_type ?? "all"}
          />
          <Select
            id="sort"
            name="sort"
            label="Sortering"
            options={[
              { value: "relevance", label: "Relevantie" },
              { value: "newest", label: "Nieuwste" },
            ]}
            defaultValue={params.sort ?? "relevance"}
          />
          <div className="flex items-end">
            <Button type="submit" fullWidth>
              Toepassen
            </Button>
          </div>
        </form>
      </CardShell>

      {productsWithPrices.length === 0 ? (
        <EmptyState
          title="Geen materialen gevonden"
          description="Pas je filters aan of probeer een bredere zoekterm."
          action={{ label: "Alle materialen", href: "/materials" }}
        />
      ) : (
        <>
          <p className="mb-6 text-sm text-[var(--muted)]">
            Pagina {page} · {productsWithPrices.length} materiaal
            {productsWithPrices.length !== 1 ? "en" : ""} op deze pagina
          </p>
          <GridLayout cols={4} gap="lg">
            {productsWithPrices.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </GridLayout>
          <div className="mt-8 flex items-center justify-between gap-3">
            {page > 1 ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={buildMaterialsHref(baseQuery, page - 1)}>
                  Vorige pagina
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {hasNextPage ? (
              <Button asChild size="sm">
                <Link href={buildMaterialsHref(baseQuery, page + 1)}>
                  Volgende pagina
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </div>
        </>
      )}
    </Container>
  );
}
