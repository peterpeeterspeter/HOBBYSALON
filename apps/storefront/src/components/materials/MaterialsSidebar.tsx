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

type MaterialsSidebarProps = {
  domains: { id: string; name: string }[];
  categoryOptions: { value: string; label: string }[];
  params: {
    q?: string;
    domain?: string;
    category?: string;
    creator_type?: string;
    sort?: string;
    view?: string;
  };
};

/**
 * Sticky filter sidebar for the materials marketplace. A plain GET form so it
 * works server-side without JavaScript; `sort` and `view` ride along as hidden
 * inputs so applying a filter doesn't reset the chosen ordering/layout.
 */
export function MaterialsSidebar({
  domains,
  categoryOptions,
  params,
}: MaterialsSidebarProps) {
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-[260px] lg:self-start lg:overflow-y-auto">
      <form method="GET" action="/materials">
        {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
        {params.view ? <input type="hidden" name="view" value={params.view} /> : null}

        <FilterBlock title="Zoeken">
          <Input
            id="q"
            name="q"
            placeholder="garen, naalden, verf..."
            defaultValue={params.q ?? ""}
            aria-label="Zoek materialen"
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

        <FilterBlock title="Categorie">
          <Select
            id="category"
            name="category"
            placeholder="Alle categorieën"
            options={categoryOptions}
            defaultValue={params.category ?? ""}
            aria-label="Categorie"
          />
        </FilterBlock>

        <FilterBlock title="Aanbieder">
          <Select
            id="creator_type"
            name="creator_type"
            options={[
              { value: "all", label: "Iedereen" },
              { value: "supplier", label: "Leveranciers" },
              { value: "maker", label: "Makers" },
            ]}
            defaultValue={params.creator_type ?? "all"}
            aria-label="Aanbieder"
          />
        </FilterBlock>

        <div className="flex flex-col gap-2">
          <Button type="submit" fullWidth>
            Toepassen
          </Button>
          <Link
            href="/materials"
            className="text-center text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
          >
            Wis alle filters
          </Link>
        </div>
      </form>
    </aside>
  );
}
