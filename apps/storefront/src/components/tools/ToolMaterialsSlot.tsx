"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics/track";
import type { MaterialNeed } from "@/lib/tools/engine";
import { formatNl } from "@/lib/tools/engine";

type SlimProduct = {
  id: string;
  slug: string;
  title: string;
  featured_image_url: string | null;
  creator_display_name: string | null;
  offer_badge: string;
  display_price: { amount: number; currency_code: string } | null;
};

type ToolMaterialsSlotProps = {
  toolSlug: string;
  formulaId: string;
  materials: MaterialNeed[];
};

function materialsHref(query: string): string {
  return `/materials?q=${encodeURIComponent(query)}`;
}

export function ToolMaterialsSlot({
  toolSlug,
  formulaId,
  materials,
}: ToolMaterialsSlotProps) {
  const primary = materials[0] ?? null;
  const query = primary?.query?.trim() ?? "";
  const [products, setProducts] = useState<SlimProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setProducts([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/tools/materials?q=${encodeURIComponent(query)}&limit=6`)
      .then(async (response) => {
        if (!response.ok) return { products: [] as SlimProduct[] };
        return (await response.json()) as { products: SlimProduct[] };
      })
      .then((payload) => {
        if (!cancelled) setProducts(payload.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const needLines = useMemo(
    () =>
      materials.filter(
        (m) => m.label.trim().length > 0
      ),
    [materials]
  );

  if (needLines.length === 0 && !query) return null;

  return (
    <section className="mt-6 rounded-[1rem] border border-[var(--border)] bg-[var(--section-highlight)] p-4 sm:p-5">
      <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
        Wat heb je nodig?
      </h3>
      {needLines.length > 0 ? (
        <ul className="mt-3 space-y-2 text-base text-[var(--foreground)]">
          {needLines.map((need) => (
            <li key={`${need.label}-${need.query}`}>
              <span className="font-semibold">{need.label}</span>
              {need.quantity != null && need.unit ? (
                <span className="text-[var(--muted)]">
                  {" "}
                  · ca. {formatNl(need.quantity, 2)} {need.unit}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {loading ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Materialen zoeken…</p>
      ) : null}

      {!loading && products.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={`/product/${product.slug}`}
                className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 transition-colors hover:border-[var(--accent)]"
                onClick={() =>
                  trackEvent("tool_materials_clicked", {
                    tool_slug: toolSlug,
                    formula_id: formulaId,
                    product_id: product.id,
                    query,
                  })
                }
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[var(--border)]">
                  {product.featured_image_url ? (
                    <img
                      src={product.featured_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                    {product.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {product.offer_badge}
                    {product.display_price && product.display_price.amount > 0
                      ? ` · €${(product.display_price.amount / 100).toFixed(2)}`
                      : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {query ? (
        <p className="mt-5">
          <Link
            href={materialsHref(query)}
            className="inline-flex min-h-12 items-center rounded-lg border border-[var(--accent)] bg-[var(--card)] px-5 text-base font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
            onClick={() =>
              trackEvent("tool_materials_clicked", {
                tool_slug: toolSlug,
                formula_id: formulaId,
                product_id: null,
                query,
              })
            }
          >
            Bekijk geschikte materialen op Hobbysalon
          </Link>
        </p>
      ) : null}
    </section>
  );
}
