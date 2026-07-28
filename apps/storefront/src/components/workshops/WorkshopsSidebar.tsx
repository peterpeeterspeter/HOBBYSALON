import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { WorkshopCategory } from "@/lib/platform/workshop-taxonomy";
import {
  WORKSHOP_OFFER_TYPES,
  WORKSHOP_OFFER_TYPE_LABELS,
  WORKSHOP_AUDIENCE_TYPES,
  WORKSHOP_AUDIENCE_LABELS,
  WORKSHOP_AGE_GROUPS,
  WORKSHOP_AGE_GROUP_LABELS,
  WORKSHOP_LANGUAGES,
  WORKSHOP_LANGUAGE_LABELS,
} from "@/lib/platform/workshop-taxonomy";

type FilterBlockProps = {
  title: string;
  children: React.ReactNode;
};

function FilterBlock({ title, children }: FilterBlockProps) {
  return (
    <div className="mb-3 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--foreground)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CheckboxGroup({
  name,
  options,
  selected,
  ariaLabel,
}: {
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  ariaLabel: string;
}) {
  const selectedSet = new Set(selected);
  return (
    <fieldset aria-label={ariaLabel} className="flex flex-col gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-2 text-sm text-[var(--foreground)]"
        >
          <input
            type="checkbox"
            name={name}
            value={option.value}
            defaultChecked={selectedSet.has(option.value)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border)]"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export type WorkshopsSidebarParams = {
  q?: string;
  domain?: string;
  category?: string;
  format?: string;
  difficulty?: string;
  city?: string;
  country?: string;
  from?: string;
  to?: string;
  offer?: string;
  audience?: string[];
  age?: string[];
  language?: string[];
  price_min?: string;
  price_max?: string;
  sort?: string;
  view?: string;
};

type WorkshopsSidebarProps = {
  domains: { id: string; name: string }[];
  categories: WorkshopCategory[];
  cities: string[];
  countries: string[];
  params: WorkshopsSidebarParams;
  hasAdvancedFilters: boolean;
};

const FORMAT_OPTIONS = [
  { value: "physical", label: "Fysiek" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybride" },
];

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Gevorderd" },
  { value: "advanced", label: "Expert" },
];

/**
 * Sticky filter sidebar for the workshops listing. A plain GET form so it works
 * server-side without JavaScript; `sort` and `view` ride along as hidden inputs
 * so applying a filter doesn't reset the chosen ordering/layout.
 */
export function WorkshopsSidebar({
  domains,
  categories,
  cities,
  countries,
  params,
  hasAdvancedFilters,
}: WorkshopsSidebarProps) {
  const domainNameById = new Map(domains.map((d) => [d.id, d.name]));
  const categoryOptions = categories
    .filter((cat) => !params.domain || cat.domain_id === params.domain)
    .map((cat) => ({
      value: cat.id,
      label: params.domain
        ? cat.name
        : `${domainNameById.get(cat.domain_id) ?? "Domein"} — ${cat.name}`,
    }));

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-[260px] lg:self-start lg:overflow-y-auto">
      <form method="GET" action="/workshops">
        {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
        {params.view ? <input type="hidden" name="view" value={params.view} /> : null}

        <FilterBlock title="Zoeken">
          <Input
            id="q"
            name="q"
            placeholder="haken, draaien, schilderen..."
            defaultValue={params.q ?? ""}
            aria-label="Zoek workshops"
          />
        </FilterBlock>

        <FilterBlock title="Domein">
          <Select
            id="domain"
            name="domain"
            placeholder="Alle domeinen"
            options={domains.map((domain) => ({
              value: domain.id,
              label: domain.name,
            }))}
            defaultValue={params.domain ?? ""}
            aria-label="Domein"
          />
          {categoryOptions.length > 0 ? (
            <div className="mt-3">
              <Select
                id="category"
                name="category"
                placeholder="Alle subcategorieën"
                options={categoryOptions}
                defaultValue={params.category ?? ""}
                aria-label="Subcategorie"
              />
            </div>
          ) : null}
        </FilterBlock>

        <FilterBlock title="Datum">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-[var(--muted)]" htmlFor="from">
              Van
            </label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={params.from ?? ""}
              aria-label="Datum vanaf"
            />
            <label className="text-sm text-[var(--muted)]" htmlFor="to">
              Tot
            </label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={params.to ?? ""}
              aria-label="Datum tot"
            />
          </div>
        </FilterBlock>

        <FilterBlock title="Plaats">
          <div className="flex flex-col gap-3">
            <Select
              id="city"
              name="city"
              placeholder="Alle steden"
              options={cities.map((city) => ({ value: city, label: city }))}
              defaultValue={params.city ?? ""}
              aria-label="Stad"
            />
            <Select
              id="country"
              name="country"
              placeholder="Alle landen"
              options={countries.map((country) => ({
                value: country,
                label: country,
              }))}
              defaultValue={params.country ?? ""}
              aria-label="Regio"
            />
          </div>
        </FilterBlock>

        <FilterBlock title="Niveau">
          <Select
            id="difficulty"
            name="difficulty"
            placeholder="Alle niveaus"
            options={DIFFICULTY_OPTIONS}
            defaultValue={params.difficulty ?? ""}
            aria-label="Niveau"
          />
        </FilterBlock>

        <details
          className="mb-3 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4"
          open={hasAdvancedFilters || undefined}
        >
          <summary className="cursor-pointer list-none font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
            Meer filters
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Aanbod
              </h4>
              <Select
                id="offer"
                name="offer"
                placeholder="Alle aanbodvormen"
                options={WORKSHOP_OFFER_TYPES.map((value) => ({
                  value,
                  label: WORKSHOP_OFFER_TYPE_LABELS[value],
                }))}
                defaultValue={params.offer ?? ""}
                aria-label="Aanbod"
              />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Voor wie
              </h4>
              <CheckboxGroup
                name="audience"
                ariaLabel="Voor wie"
                selected={params.audience ?? []}
                options={WORKSHOP_AUDIENCE_TYPES.map((value) => ({
                  value,
                  label: WORKSHOP_AUDIENCE_LABELS[value],
                }))}
              />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Leeftijd
              </h4>
              <CheckboxGroup
                name="age"
                ariaLabel="Leeftijd"
                selected={params.age ?? []}
                options={WORKSHOP_AGE_GROUPS.map((value) => ({
                  value,
                  label: WORKSHOP_AGE_GROUP_LABELS[value],
                }))}
              />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Taal
              </h4>
              <CheckboxGroup
                name="language"
                ariaLabel="Taal"
                selected={params.language ?? []}
                options={WORKSHOP_LANGUAGES.map((value) => ({
                  value,
                  label: WORKSHOP_LANGUAGE_LABELS[value],
                }))}
              />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Prijs (€)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  id="price_min"
                  name="price_min"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Min"
                  defaultValue={params.price_min ?? ""}
                  aria-label="Minimumprijs"
                />
                <Input
                  id="price_max"
                  name="price_max"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Max"
                  defaultValue={params.price_max ?? ""}
                  aria-label="Maximumprijs"
                />
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Format
              </h4>
              <Select
                id="format"
                name="format"
                placeholder="Alle formats"
                options={FORMAT_OPTIONS}
                defaultValue={params.format ?? ""}
                aria-label="Format"
              />
            </div>
          </div>
        </details>

        <div className="flex flex-col gap-2">
          <Button type="submit" fullWidth>
            Toepassen
          </Button>
          <Link
            href="/workshops"
            className="text-center text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
          >
            Wis alle filters
          </Link>
        </div>
      </form>
    </aside>
  );
}
