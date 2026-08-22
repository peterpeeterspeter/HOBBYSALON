import { FeaturedListingHero } from "@/components/shared/FeaturedListingHero";
import {
  ListingSearchShell,
} from "@/components/shared/ListingHeroBand";
import { ListingSearchEverywhereHint } from "@/components/shared/ListingSearchEverywhereHint";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import type { FeaturedListingItem } from "@/lib/listing/featured-hero";

type WorkshopsHeroProps = {
  featured?: FeaturedListingItem | null;
  hiddenFields?: Record<string, string | undefined>;
  defaultQuery?: string;
};

export function WorkshopsHero({
  featured = null,
  hiddenFields = {},
  defaultQuery,
}: WorkshopsHeroProps) {
  return (
    <FeaturedListingHero
      title="Vind een workshop die bij je past"
      lead="Filter workshops dichtbij of online."
      fallbackImageSrc={LANDING_IMAGES.workshop}
      featured={featured}
      footer={<ListingSearchEverywhereHint query={defaultQuery} />}
    >
      <form method="GET" action="/workshops" role="search">
        {Object.entries(hiddenFields).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}
        <ListingSearchShell
          id="workshops-q"
          label="Filter workshops"
          placeholder="Filter op keramiek, haken of juwelen"
          defaultValue={defaultQuery}
        />
      </form>
    </FeaturedListingHero>
  );
}
