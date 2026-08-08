import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import { listProductsByDomain } from "@/lib/platform/queries/products";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import { medusaAmountToCents } from "@/lib/commerce/money";
import { publicAssetUrl } from "@/lib/media/public-asset-url";
import { ProductCard } from "@/components/cards";
import { DomainSubListingShell } from "@/components/domain/DomainSubListingShell";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import type { Product } from "@/types/platform";

type Props = { params: Promise<{ domain: string }> };

type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

async function enrichProductsWithPrices(
  products: Product[]
): Promise<ProductWithPrice[]> {
  return Promise.all(
    products.map(async (product) => {
      const medusa = await getMedusaProduct(product.medusa_product_id);
      const price = medusa?.calculated_price
        ? {
            amount: medusaAmountToCents(
              medusa.calculated_price.calculated_amount
            ),
            currency_code: medusa.calculated_price.currency_code,
          }
        : null;
      return {
        ...product,
        featured_image_url: publicAssetUrl(product.featured_image_url),
        price,
      };
    })
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  if (!domain) return { title: "Niet gevonden" };
  return {
    title: `${domain.name} benodigdheden | Hobbysalon`,
    description: domain.short_description ?? undefined,
  };
}

export default async function DomainSuppliesPage({ params }: Props) {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  if (!domain) notFound();

  const products = await listProductsByDomain(domain.id, "supply");
  const productsWithPrices = await enrichProductsWithPrices(products);

  const lead =
    productsWithPrices.length > 0
      ? `${productsWithPrices.length} product${productsWithPrices.length !== 1 ? "en" : ""}`
      : undefined;

  return (
    <DomainSubListingShell
      domain={domain}
      title="Benodigdheden & materialen"
      lead={lead}
      breadcrumbLabel="Benodigdheden"
    >
      {productsWithPrices.length === 0 ? (
        <EmptyState
          title="Nog geen benodigdheden"
          description="Nog geen benodigdheden in dit domein."
          action={{ label: `Terug naar ${domain.name}`, href: `/${domain.slug}` }}
        />
      ) : (
        <GridLayout cols={4} gap="lg">
          {productsWithPrices.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </GridLayout>
      )}
    </DomainSubListingShell>
  );
}
