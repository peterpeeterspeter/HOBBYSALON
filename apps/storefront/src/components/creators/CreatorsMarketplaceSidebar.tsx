import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  MATERIALS_CONDITION_OPTIONS,
  MATERIALS_PRICE_BAND_OPTIONS,
} from "@/lib/materials/materials-catalog-helpers";

type CreatorsMarketplaceSidebarProps = {
  categoryOptions: { value: string; label: string }[];
  domainOptions: { value: string; label: string }[];
  sellerOptions: { value: string; label: string }[];
  params: {
    q?: string;
    category?: string;
    sub?: string;
    domain?: string;
    seller?: string;
    offer?: string;
    condition?: string;
    price?: string;
    featured?: string;
    sort?: string;
  };
};

const OFFER_OPTIONS = [
  { value: "maker", label: "Handgemaakt" },
  { value: "destash", label: "Restanten / tweedehands" },
];

/**
 * P2P marketplace filters: category, hobby, seller, offer type, price, condition.
 */
export function CreatorsMarketplaceSidebar({
  categoryOptions,
  domainOptions,
  sellerOptions,
  params,
}: CreatorsMarketplaceSidebarProps) {
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-[260px] lg:self-start lg:overflow-y-auto">
      <form method="GET" action="/creators" className="flex flex-col gap-3">
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

        {domainOptions.length > 0 ? (
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold">
              Hobby
            </h3>
            <Select
              id="domain"
              name="domain"
              placeholder="Alle hobbies"
              options={domainOptions}
              defaultValue={params.domain ?? ""}
              aria-label="Hobby"
            />
          </div>
        ) : null}

        {sellerOptions.length > 0 ? (
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold">
              Maker
            </h3>
            <Select
              id="seller"
              name="seller"
              placeholder="Alle makers"
              options={sellerOptions}
              defaultValue={params.seller ?? ""}
              aria-label="Maker"
            />
          </div>
        ) : null}

        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold">
            Soort
          </h3>
          <Select
            id="offer"
            name="offer"
            placeholder="Alles van makers"
            options={OFFER_OPTIONS}
            defaultValue={params.offer ?? ""}
            aria-label="Soort"
          />
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold">
            Prijs
          </h3>
          <Select
            id="price"
            name="price"
            placeholder="Alle prijzen"
            options={MATERIALS_PRICE_BAND_OPTIONS.map((band) => ({
              value: band.value,
              label: band.label,
            }))}
            defaultValue={params.price ?? ""}
            aria-label="Prijs"
          />
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold">
            Conditie
          </h3>
          <Select
            id="condition"
            name="condition"
            placeholder="Alle condities"
            options={MATERIALS_CONDITION_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            defaultValue={params.condition ?? ""}
            aria-label="Conditie"
          />
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-medium text-[var(--foreground)]">
            <input
              type="checkbox"
              name="featured"
              value="1"
              defaultChecked={params.featured === "1"}
              className="size-5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            Alleen uitgelicht
          </label>
        </div>

        <Button type="submit" fullWidth className="min-h-11">
          Toepassen
        </Button>
        <Link
          href="/creators"
          className="min-h-11 text-center text-sm font-semibold leading-[2.75rem] text-[var(--muted)] hover:text-[var(--accent)]"
        >
          Wis alle filters
        </Link>
      </form>
    </aside>
  );
}
