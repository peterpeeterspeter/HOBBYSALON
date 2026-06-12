import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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

const EVENT_TYPE_OPTIONS = [
  { value: "handmade_market", label: "Handmade markt" },
  { value: "hobby_fair", label: "Hobbybeurs" },
  { value: "pop_up", label: "Pop-up" },
  { value: "open_atelier", label: "Open atelier" },
  { value: "workshop_day", label: "Workshopdag" },
];

type AgendaSidebarProps = {
  domains: { id: string; name: string }[];
  cities: string[];
  countries: string[];
  params: {
    domain?: string;
    type?: string;
    city?: string;
    country?: string;
    from?: string;
    to?: string;
    sort?: string;
  };
};

/**
 * Sticky filter sidebar for the agenda listing. A plain GET form so it works
 * server-side without JavaScript; sort rides along as a hidden input so applying
 * a filter doesn't reset the chosen ordering.
 */
export function AgendaSidebar({
  domains,
  cities,
  countries,
  params,
}: AgendaSidebarProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-[260px] lg:self-start lg:overflow-y-auto">
      <form method="GET" action="/agenda">
        {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}

        <FilterBlock title="Domein">
          <Select
            id="domain"
            name="domain"
            placeholder="Alle domeinen"
            options={domains.map((d) => ({ value: d.id, label: d.name }))}
            defaultValue={params.domain ?? ""}
            aria-label="Domein"
          />
        </FilterBlock>

        <FilterBlock title="Type evenement">
          <Select
            id="type"
            name="type"
            placeholder="Alle types"
            options={EVENT_TYPE_OPTIONS}
            defaultValue={params.type ?? ""}
            aria-label="Type"
          />
        </FilterBlock>

        <FilterBlock title="Stad">
          <Select
            id="city"
            name="city"
            placeholder="Alle steden"
            options={cities.map((c) => ({ value: c, label: c }))}
            defaultValue={params.city ?? ""}
            aria-label="Stad"
          />
        </FilterBlock>

        <FilterBlock title="Regio (land)">
          <Select
            id="country"
            name="country"
            placeholder="Alle landen"
            options={countries.map((c) => ({ value: c, label: c }))}
            defaultValue={params.country ?? ""}
            aria-label="Regio"
          />
        </FilterBlock>

        <FilterBlock title="Datum">
          <div className="flex flex-col gap-2">
            <Input
              id="from"
              name="from"
              type="date"
              label="Vanaf"
              defaultValue={params.from ?? todayStr}
            />
            <Input
              id="to"
              name="to"
              type="date"
              label="Tot en met"
              defaultValue={params.to ?? ""}
            />
          </div>
        </FilterBlock>

        <div className="flex flex-col gap-2">
          <Button type="submit" fullWidth>
            Toepassen
          </Button>
          <Link
            href="/agenda"
            className="text-center text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
          >
            Wis alle filters
          </Link>
        </div>
      </form>
    </aside>
  );
}
