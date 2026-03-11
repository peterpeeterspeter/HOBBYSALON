import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDomainBySlug } from "@/lib/platform/queries/domains";
import { listProductsByDomain } from "@/lib/platform/queries/products";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import { ProductCard } from "@/components/shared/ProductCard";
import type { Product } from "@/types/platform";

type Props = { params: Promise<{ domain: string }> };

type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

async function enrichProductsWithPrices(products: Product[]): Promise<ProductWithPrice[]> {
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/${domain.slug}`} className="hover:text-[var(--foreground)]">
              {domain.name}
            </Link>
          </li>
          <li>/</li>
          <li className="text-[var(--foreground)]">Benodigdheden</li>
        </ol>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          {domain.name} benodigdheden
        </h1>
      </header>

      {productsWithPrices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-12 text-center text-[var(--muted)]">
          Nog geen benodigdheden in dit domein.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {productsWithPrices.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
