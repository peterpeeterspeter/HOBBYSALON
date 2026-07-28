import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import { listProductsByDomain } from "@/lib/platform/queries/products";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import { ProductCard } from "@/components/cards";
import { DomainSubListingShell } from "@/components/domain/DomainSubListingShell";
import { GridLayout } from "@/components/layout/grid-layout";
import { EmptyState } from "@/components/ui/empty-state";
import type { Product } from "@/types/platform";

type Props = { params: Promise<{ domain: string }> };

type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

async function enrichProductsWithPrices(products: Product[]): Promise<ProductWithPrice[]> {
  return Promise.all(
    products.map(async (product) => {
      if (product.medusa_product_id) {
        const medusa = await getMedusaProduct(product.medusa_product_id);
        const price = medusa?.calculated_price
          ? {
              amount: medusa.calculated_price.calculated_amount,
              currency_code: medusa.calculated_price.currency_code,
            }
          : null;
        return { ...product, price };
      }
      if (typeof product.price_cents === "number") {
        return {
          ...product,
          price: {
            amount: product.price_cents,
            currency_code: (product.currency_code ?? "EUR").toLowerCase(),
          },
        };
      }
      return { ...product, price: null };
    })
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  if (!domain) return { title: "Niet gevonden" };
  return {
    title: `${domain.name} handgemaakt | Hobbysalon`,
    description: domain.short_description ?? undefined,
  };
}

export default async function DomainHandmadePage({ params }: Props) {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  if (!domain) notFound();

  const products = await listProductsByDomain(domain.id, "handmade");
  const productsWithPrices = await enrichProductsWithPrices(products);

  return (
    <DomainSubListingShell
      domain={domain}
      title="Handgemaakt"
      breadcrumbLabel="Handgemaakt"
    >
      {productsWithPrices.length === 0 ? (
        <EmptyState
          title="Nog geen handgemaakte producten"
          description="Nog geen handgemaakte producten in dit domein."
          action={{ label: "Terug naar domein", href: `/${domain.slug}` }}
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
