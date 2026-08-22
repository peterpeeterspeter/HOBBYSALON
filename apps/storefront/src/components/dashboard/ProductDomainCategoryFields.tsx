"use client";

import { useMemo, useState } from "react";

type ProductCategoryOption = {
  id: string;
  name: string;
  domain_id: string | null;
};

type ProductDomainCategoryFieldsProps = {
  domainOptions: { value: string; label: string }[];
  categories: ProductCategoryOption[];
  defaults?: {
    domain_id?: string | null;
    category_id?: string | null;
  };
  /** Require a domain before submit */
  domainRequired?: boolean;
};

function categoryBelongsToDomain(
  categories: ProductCategoryOption[],
  categoryId: string,
  domainId: string
): boolean {
  if (!categoryId || !domainId) return false;
  return categories.some(
    (cat) => cat.id === categoryId && cat.domain_id === domainId
  );
}

export function ProductDomainCategoryFields({
  domainOptions,
  categories,
  defaults,
  domainRequired = false,
}: ProductDomainCategoryFieldsProps) {
  const initialDomainId = defaults?.domain_id ?? "";
  const initialCategoryId =
    defaults?.category_id &&
    categoryBelongsToDomain(categories, defaults.category_id, initialDomainId)
      ? defaults.category_id
      : "";

  const [domainId, setDomainId] = useState(initialDomainId);
  const [categoryId, setCategoryId] = useState(initialCategoryId);

  const categoryOptions = useMemo(() => {
    if (!domainId) return [];
    return categories
      .filter((cat) => cat.domain_id === domainId)
      .sort((a, b) => a.name.localeCompare(b.name, "nl"));
  }, [categories, domainId]);

  function handleDomainChange(nextDomainId: string) {
    setDomainId(nextDomainId);
    if (
      categoryId &&
      !categoryBelongsToDomain(categories, categoryId, nextDomainId)
    ) {
      setCategoryId("");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="product-domain-id"
          className="text-sm font-medium text-[var(--foreground)]"
        >
          Domein{domainRequired ? " *" : ""}
        </label>
        <select
          id="product-domain-id"
          name="domain_id"
          required={domainRequired}
          value={domainId}
          onChange={(event) => handleDomainChange(event.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        >
          <option value="">Selecteer domein</option>
          {domainOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="product-category-id"
          className="text-sm font-medium text-[var(--foreground)]"
        >
          Categorie
        </label>
        <select
          id="product-category-id"
          name="category_id"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          disabled={!domainId}
          className="min-h-[44px] w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">
            {domainId ? "Selecteer categorie" : "Kies eerst een domein"}
          </option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-[var(--muted)]">
          {domainId
            ? categoryOptions.length > 0
              ? "Alleen categorieën van het gekozen domein."
              : "Geen categorieën voor dit domein."
            : "Kies eerst een domein."}
        </p>
      </div>
    </>
  );
}
