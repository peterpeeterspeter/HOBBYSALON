import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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

type WorkshopsSidebarProps = {
  domains: { id: string; name: string }[];
  cities: string[];
  countries: string[];
  params: {
    q?: string;
    domain?: string;
    format?: string;
    difficulty?: string;
    city?: string;
    country?: string;
    sort?: string;
    view?: string;
  };
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
  cities,
  countries,
  params,
}: WorkshopsSidebarProps) {
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
            options={domains.map((domain) => ({ value: domain.id, label: domain.name }))}
            defaultValue={params.domain ?? ""}
            aria-label="Domein"
          />
        </FilterBlock>

        <FilterBlock title="Format">
          <Select
            id="format"
            name="format"
            placeholder="Alle formats"
            options={FORMAT_OPTIONS}
            defaultValue={params.format ?? ""}
            aria-label="Format"
          />
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

        <FilterBlock title="Stad">
          <Select
            id="city"
            name="city"
            placeholder="Alle steden"
            options={cities.map((city) => ({ value: city, label: city }))}
            defaultValue={params.city ?? ""}
            aria-label="Stad"
          />
        </FilterBlock>

        <FilterBlock title="Regio (land)">
          <Select
            id="country"
            name="country"
            placeholder="Alle landen"
            options={countries.map((country) => ({ value: country, label: country }))}
            defaultValue={params.country ?? ""}
            aria-label="Regio"
          />
        </FilterBlock>

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
