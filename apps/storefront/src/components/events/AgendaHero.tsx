import { FeaturedListingHero } from "@/components/shared/FeaturedListingHero";
import { ListingSearchShell } from "@/components/shared/ListingHeroBand";
import { ListingSearchEverywhereHint } from "@/components/shared/ListingSearchEverywhereHint";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import type { FeaturedListingItem } from "@/lib/listing/featured-hero";

type AgendaHeroProps = {
  featured?: FeaturedListingItem | null;
  hiddenFields?: Record<string, string | undefined>;
  defaultQuery?: string;
};

export function AgendaHero({
  featured = null,
  hiddenFields = {},
  defaultQuery,
}: AgendaHeroProps) {
  return (
    <FeaturedListingHero
      title="Ga eropuit voor je hobby"
      lead="Filter handmade markten, beurzen en open ateliers."
      fallbackImageSrc={LANDING_IMAGES.community}
      featured={featured}
      footer={<ListingSearchEverywhereHint query={defaultQuery} />}
    >
      <form method="GET" action="/agenda" role="search">
        {Object.entries(hiddenFields).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}
        <ListingSearchShell
          id="agenda-q"
          label="Filter events"
          placeholder="Filter op event, plaats of hobby"
          defaultValue={defaultQuery}
        />
      </form>
    </FeaturedListingHero>
  );
}
