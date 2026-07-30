"use client";

import { useMemo, useState } from "react";
import {
  WORKSHOP_AGE_GROUPS,
  WORKSHOP_AGE_GROUP_LABELS,
  WORKSHOP_AUDIENCE_TYPES,
  WORKSHOP_AUDIENCE_LABELS,
  WORKSHOP_LANGUAGES,
  WORKSHOP_LANGUAGE_LABELS,
  WORKSHOP_OFFER_TYPES,
  WORKSHOP_OFFER_TYPE_LABELS,
  type WorkshopCategory,
} from "@/lib/platform/workshop-taxonomy";

type WorkshopTaxonomyFieldsProps = {
  categories: WorkshopCategory[];
  domainOptions: { value: string; label: string }[];
  defaults?: {
    domain_id?: string | null;
    category_id?: string | null;
    offer_type?: string | null;
    audience_types?: string[] | null;
    age_groups?: string[] | null;
    languages?: string[] | null;
  };
};

function categoryBelongsToDomain(
  categories: WorkshopCategory[],
  categoryId: string,
  domainId: string
): boolean {
  if (!categoryId || !domainId) return false;
  return categories.some(
    (cat) => cat.id === categoryId && cat.domain_id === domainId
  );
}

export function WorkshopTaxonomyFields({
  categories,
  domainOptions,
  defaults,
}: WorkshopTaxonomyFieldsProps) {
  const audience = new Set(defaults?.audience_types ?? []);
  const ages = new Set(defaults?.age_groups ?? []);
  const defaultLanguages = defaults?.languages ?? [];
  const languages = new Set(
    defaultLanguages.length > 0 ? defaultLanguages : ["nl"]
  );

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
      <label>
        <span className="mb-1 block text-sm font-medium">
          Categorie / domein *
        </span>
        <select
          name="domain_id"
          required
          value={domainId}
          onChange={(event) => handleDomainChange(event.target.value)}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
        >
          <option value="">Selecteer categorie</option>
          {domainOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium">Subcategorie</span>
        <select
          name="category_id"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          disabled={!domainId}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">
            {domainId ? "Geen subcategorie" : "Kies eerst een categorie"}
          </option>
          {categoryOptions.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {domainId
            ? categoryOptions.length > 0
              ? "Optioneel. Alleen subcategorieën van de gekozen categorie."
              : "Geen subcategorieën voor deze categorie."
            : "Kies eerst een categorie / domein."}
        </p>
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium">Aanbodvorm</span>
        <select
          name="offer_type"
          defaultValue={defaults?.offer_type ?? ""}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
        >
          <option value="">Niet opgegeven</option>
          {WORKSHOP_OFFER_TYPES.map((value) => (
            <option key={value} value={value}>
              {WORKSHOP_OFFER_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">Voor wie</legend>
        <div className="flex flex-wrap gap-3">
          {WORKSHOP_AUDIENCE_TYPES.map((value) => (
            <label key={value} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="audience_types"
                value={value}
                defaultChecked={audience.has(value)}
              />
              {WORKSHOP_AUDIENCE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">Leeftijd</legend>
        <div className="flex flex-wrap gap-3">
          {WORKSHOP_AGE_GROUPS.map((value) => (
            <label key={value} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="age_groups"
                value={value}
                defaultChecked={ages.has(value)}
              />
              {WORKSHOP_AGE_GROUP_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">Taal *</legend>
        <div className="flex flex-wrap gap-3">
          {WORKSHOP_LANGUAGES.map((value) => (
            <label key={value} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="languages"
                value={value}
                defaultChecked={languages.has(value)}
              />
              {WORKSHOP_LANGUAGE_LABELS[value]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Kies minstens één taal waarin de workshop gegeven wordt.
        </p>
      </fieldset>
    </>
  );
}
