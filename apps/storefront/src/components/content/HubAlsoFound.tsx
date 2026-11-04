import Link from "next/link";
import { ProductCard, WorkshopCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { searchAll } from "@/lib/services/search-page";

const MAX_PER_TYPE = 4;

/**
 * The inspiration hubs search only articles. With a search term, this block
 * also shows matching workshops and products, so a search never hides them.
 */
export async function HubAlsoFound({ query }: { query?: string }) {
  const q = query?.trim() ?? "";
  if (q.length < 2) return null;

  const { workshops, products } = await searchAll(q);
  const shownWorkshops = workshops.slice(0, MAX_PER_TYPE);
  const shownProducts = products.slice(0, MAX_PER_TYPE);
  if (shownWorkshops.length === 0 && shownProducts.length === 0) return null;

  const allHref = `/zoeken?q=${encodeURIComponent(q)}`;

  return (
    <section
      aria-labelledby="also-found-title"
      className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--section-alt)] p-6 sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="also-found-title"
            className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] [text-wrap:balance]"
          >
            Ook gevonden voor “{q}”
          </h2>
          <p className="mt-1 text-lg text-[var(--muted)]">
            Workshops en materialen die bij je zoekopdracht passen.
          </p>
        </div>
        <Link
          href={allHref}
          className="inline-flex min-h-12 items-center text-base font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
        >
          Bekijk alle resultaten
        </Link>
      </div>

      <div className="flex flex-col gap-8">
        {shownWorkshops.length > 0 ? (
          <div>
            <h3 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
              Workshops
              {workshops.length > shownWorkshops.length ? (
                <span className="ml-2 text-base font-semibold text-[var(--muted)]">
                  {shownWorkshops.length} van {workshops.length}
                </span>
              ) : null}
            </h3>
            <GridLayout cols={4} gap="md">
              {shownWorkshops.map((w) => (
                <WorkshopCard key={w.id} workshop={w} />
              ))}
            </GridLayout>
          </div>
        ) : null}

        {shownProducts.length > 0 ? (
          <div>
            <h3 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
              Materialen en producten
              {products.length > shownProducts.length ? (
                <span className="ml-2 text-base font-semibold text-[var(--muted)]">
                  {shownProducts.length} van {products.length}
                </span>
              ) : null}
            </h3>
            <GridLayout cols={4} gap="md">
              {shownProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </GridLayout>
          </div>
        ) : null}
      </div>
    </section>
  );
}
