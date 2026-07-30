import {
  ListingHeroBand,
  ListingSearchShell,
} from "@/components/shared/ListingHeroBand";
import { ListingSearchEverywhereHint } from "@/components/shared/ListingSearchEverywhereHint";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";

type MaterialsHeroProps = {
  hiddenFields?: Record<string, string | undefined>;
  defaultQuery?: string;
};

export function MaterialsHero({
  hiddenFields = {},
  defaultQuery,
}: MaterialsHeroProps) {
  return (
    <ListingHeroBand
      title="Vind de juiste materialen voor je project"
      lead="Filter materialen op materiaal, merk, kleur of techniek."
      imageSrc={LANDING_IMAGES.craftsGrid}
      size="compact"
      footer={<ListingSearchEverywhereHint query={defaultQuery} />}
    >
      <form method="GET" action="/materials" role="search">
        {Object.entries(hiddenFields).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}
        <ListingSearchShell
          id="materials-q"
          label="Filter materialen"
          placeholder="Filter op garen, klei, verf of een merk"
          defaultValue={defaultQuery}
        />
      </form>
    </ListingHeroBand>
  );
}
