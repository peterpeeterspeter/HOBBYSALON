import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type FilterBlockProps = { title: string; children: React.ReactNode };
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

const TYPE_OPTIONS = [
  { value: "maker", label: "Maker" },
  { value: "workshopgever", label: "Workshopgever" },
  { value: "supplier", label: "Leverancier" },
  { value: "content_creator", label: "Content maker" },
  { value: "organizer", label: "Organisator" },
];

type CreatorsSidebarProps = {
  domains: { id: string; name: string }[];
  params: { q?: string; domain?: string; creator_type?: string };
};

export function CreatorsSidebar({ domains, params }: CreatorsSidebarProps) {
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-[260px] lg:self-start lg:overflow-y-auto">
      <form method="GET" action="/creators">
        <FilterBlock title="Zoeken">
          <Input
            id="q"
            name="q"
            placeholder="Naam, stad, expertise..."
            defaultValue={params.q ?? ""}
            aria-label="Zoek creators"
          />
        </FilterBlock>

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

        <FilterBlock title="Type creator">
          <Select
            id="creator_type"
            name="creator_type"
            placeholder="Alle types"
            options={TYPE_OPTIONS}
            defaultValue={params.creator_type ?? ""}
            aria-label="Type creator"
          />
        </FilterBlock>

        <div className="flex flex-col gap-2">
          <Button type="submit" fullWidth>
            Toepassen
          </Button>
          <Link
            href="/creators"
            className="text-center text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
          >
            Wis alle filters
          </Link>
        </div>
      </form>
    </aside>
  );
}
