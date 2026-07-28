import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type MaterialsCatalogSidebarProps = {
  categoryOptions: { value: string; label: string }[];
  params: {
    q?: string;
    category?: string;
    sub?: string;
    offer?: string;
    condition?: string;
    sort?: string;
  };
  showCondition?: boolean;
};

const OFFER_OPTIONS = [
  { value: "webshop", label: "Webshop" },
  { value: "maker", label: "Maker" },
  { value: "destash", label: "Tweedehands" },
  { value: "kit", label: "Workshoppakket" },
];

/**
 * Short buy-oriented sidebar: category + aanbieder (+ optional condition).
 * No duplicate search, no price/stock filters.
 */
export function MaterialsCatalogSidebar({
  categoryOptions,
  params,
  showCondition = false,
}: MaterialsCatalogSidebarProps) {
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-[240px] lg:self-start lg:overflow-y-auto">
      <form method="GET" action="/materials" className="flex flex-col gap-3">
        {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
        {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
        {params.sub ? <input type="hidden" name="sub" value={params.sub} /> : null}

        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold">
            Categorie
          </h3>
          <Select
            id="category"
            name="category"
            placeholder="Alle categorieën"
            options={categoryOptions}
            defaultValue={params.category ?? ""}
            aria-label="Categorie"
          />
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold">
            Aanbieder
          </h3>
          <Select
            id="offer"
            name="offer"
            placeholder="Alle aanbieders"
            options={OFFER_OPTIONS}
            defaultValue={params.offer ?? ""}
            aria-label="Aanbieder"
          />
        </div>

        {showCondition ? (
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold">
              Conditie
            </h3>
            <Select
              id="condition"
              name="condition"
              placeholder="Alle condities"
              options={[
                { value: "new", label: "Nieuw" },
                { value: "used", label: "Gebruikt" },
                { value: "like_new", label: "Als nieuw" },
              ]}
              defaultValue={params.condition ?? ""}
              aria-label="Conditie"
            />
          </div>
        ) : null}

        <Button type="submit" fullWidth>
          Toepassen
        </Button>
        <Link
          href="/materials"
          className="text-center text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
        >
          Wis alle filters
        </Link>
      </form>
    </aside>
  );
}
