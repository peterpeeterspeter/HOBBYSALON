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
import { createPlatformClient } from "@/lib/platform/client";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import {
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
  creator_type?: string;
  city?: string;
  country?: string;
  sort?: string;
}>;

type ProductWithPrice = SupplyMarketplaceProduct & {
  price?: { amount: number; currency_code: string } | null;
};

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
  if (sort === "price_asc") {
    return [...products].sort((a, b) => {
      const left = a.price?.amount ?? Number.POSITIVE_INFINITY;
      const right = b.price?.amount ?? Number.POSITIVE_INFINITY;
      return left - right;
    });
  }
  if (sort === "price_desc") {
    return [...products].sort((a, b) => {
      const left = a.price?.amount ?? Number.NEGATIVE_INFINITY;
      const right = b.price?.amount ?? Number.NEGATIVE_INFINITY;
      return right - left;
    });
  }
  return products;
}

async function listCreatorLocationOptions() {
  const supabase = createPlatformClient();
  const [{ data: cityRows }, { data: countryRows }] = await Promise.all([
    supabase.from("creators").select("city").not("city", "is", null).limit(3000),
    supabase
      .from("creators")
      .select("country_code")
      .not("country_code", "is", null)
      .limit(3000),
  ]);

  const cities = [
    ...new Set(
      (cityRows ?? [])
        .map((row) => row.city)
        .filter((city): city is string => Boolean(city))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const countries = [
    ...new Set(
      (countryRows ?? [])
        .map((row) => row.country_code)
        .filter((country): country is string => Boolean(country))
    ),
  ].sort((a, b) => a.localeCompare(b));

  return { cities, countries };
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
  const locationPreference = await getLocationPreference();
  const [domains, locationOptions, supplyProducts] = await Promise.all([
    listActiveDomains(),
    listCreatorLocationOptions(),
    listSupplyMarketplaceProducts({
      q: params.q,
      domain_id: params.domain,
      creator_type: creatorTypeFilter,
      city: params.city,
      country_code: params.country,
      preferred_city: locationPreference.city ?? undefined,
      preferred_country_code: locationPreference.countryCode ?? undefined,
      limit: 72,
    }),
  ]);

  const productsWithPrices = sortProducts(
    await enrichProductsWithPrices(supplyProducts),
    params.sort
  );

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
            {locationPreference.city && (
              <Link
                href={`/materials?city=${encodeURIComponent(locationPreference.city)}`}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Alleen {locationPreference.city}
              </Link>
            )}
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
        <form method="GET" action="/materials" className="grid gap-4 sm:grid-cols-7">
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
            id="city"
            name="city"
            label="Stad"
            placeholder="Alle steden"
            options={locationOptions.cities.map((city) => ({
              value: city,
              label: city,
            }))}
            defaultValue={params.city ?? ""}
          />
          <Select
            id="country"
            name="country"
            label="Land"
            placeholder="Alle landen"
            options={locationOptions.countries.map((country) => ({
              value: country,
              label: country,
            }))}
            defaultValue={params.country ?? ""}
          />
          <Select
            id="sort"
            name="sort"
            label="Sortering"
            options={[
              { value: "relevance", label: "Relevantie" },
              { value: "newest", label: "Nieuwste" },
              { value: "price_asc", label: "Prijs (laag-hoog)" },
              { value: "price_desc", label: "Prijs (hoog-laag)" },
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
            {productsWithPrices.length} materiaal
            {productsWithPrices.length !== 1 ? "en" : ""} gevonden
          </p>
          <GridLayout cols={4} gap="lg">
            {productsWithPrices.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </GridLayout>
        </>
      )}
    </Container>
  );
}
