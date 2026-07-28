import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AspectImage } from "@/components/ui/aspect-image";
import type { Product } from "@/types/platform";

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  handmade: "Handmade",
  destash: "Destash",
  supply: "Benodigdheden",
};

type DashboardProductListItemProps = {
  product: Product;
  priceLabel: string;
  children: React.ReactNode;
};

export function DashboardProductListItem({
  product,
  priceLabel,
  children,
}: DashboardProductListItemProps) {
  const typeLabel =
    PRODUCT_TYPE_LABELS[product.product_type] ?? product.product_type;
  const publicHref = `/product/${product.slug}`;

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">
        <div className="w-24 shrink-0 sm:w-28">
          <AspectImage
            ratio="square"
            src={product.featured_image_url}
            alt={product.title}
            fallbackImage="placeholderProduct"
            className="rounded-lg"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold leading-snug text-[var(--foreground)]">
                {product.title}
              </h3>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-[var(--muted)]">
                <span
                  className={
                    product.is_active
                      ? "font-medium text-[var(--accent-secondary)]"
                      : "font-medium text-[var(--muted)]"
                  }
                >
                  {product.is_active ? "Gepubliceerd" : "Concept"}
                </span>
                <span aria-hidden="true">·</span>
                <span>{typeLabel}</span>
                {priceLabel ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[var(--foreground)]">
                      {priceLabel}
                    </span>
                  </>
                ) : null}
                <span aria-hidden="true">·</span>
                <span>{product.medusa_product_id ? "Webshop" : "Contact"}</span>
              </p>
            </div>

            {product.is_active ? (
              <Link
                href={publicHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 text-base font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 active:scale-[0.98]"
              >
                Bekijk op de website
                <ExternalLink size={18} aria-hidden="true" />
              </Link>
            ) : (
              <p className="max-w-[16rem] text-sm leading-relaxed text-[var(--muted)] sm:text-right">
                Publiceer om je creatie op de website te tonen.
              </p>
            )}
          </div>

          <details className="group mt-4 border-t border-[var(--border)] pt-3">
            <summary className="cursor-pointer list-none text-base font-semibold text-[var(--accent)] marker:content-none hover:underline [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Bewerken</span>
              <span className="hidden group-open:inline">Bewerken sluiten</span>
            </summary>
            <div className="mt-4">{children}</div>
          </details>
        </div>
      </div>
    </article>
  );
}
