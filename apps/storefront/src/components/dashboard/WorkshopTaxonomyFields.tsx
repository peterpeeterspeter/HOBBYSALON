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

export function WorkshopTaxonomyFields({
  categories,
  domainOptions,
  defaults,
}: WorkshopTaxonomyFieldsProps) {
  const audience = new Set(defaults?.audience_types ?? []);
  const ages = new Set(defaults?.age_groups ?? []);
  const languages = new Set(defaults?.languages ?? []);
  const domainId = defaults?.domain_id ?? "";

  const categoryOptions = categories.filter(
    (cat) => !domainId || cat.domain_id === domainId
  );

  return (
    <>
      <label>
        <span className="mb-1 block text-sm font-medium">Categorie / domein</span>
        <select
          name="domain_id"
          defaultValue={domainId}
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
          defaultValue={defaults?.category_id ?? ""}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
        >
          <option value="">Geen subcategorie</option>
          {(domainId ? categoryOptions : categories).map((cat) => {
            const domainLabel =
              domainOptions.find((d) => d.value === cat.domain_id)?.label ?? "";
            return (
              <option key={cat.id} value={cat.id}>
                {domainId ? cat.name : `${domainLabel} — ${cat.name}`}
              </option>
            );
          })}
        </select>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Optioneel. Kies een subcategorie die bij het domein past.
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
