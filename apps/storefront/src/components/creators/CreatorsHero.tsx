import Link from "next/link";
import { FeaturedListingHero } from "@/components/shared/FeaturedListingHero";
import { ListingSearchShell } from "@/components/shared/ListingHeroBand";
import { ListingSearchEverywhereHint } from "@/components/shared/ListingSearchEverywhereHint";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import type { FeaturedListingItem } from "@/lib/listing/featured-hero";

type CreatorsHeroProps = {
  featured?: FeaturedListingItem | null;
  hiddenFields?: Record<string, string | undefined>;
  defaultQuery?: string;
};

export function CreatorsHero({
  featured = null,
  hiddenFields = {},
  defaultQuery,
}: CreatorsHeroProps) {
  return (
    <FeaturedListingHero
      title="Koop rechtstreeks van makers"
      lead="Filter handgemaakte creaties en restanten van makers."
      fallbackImageSrc={LANDING_IMAGES.community}
      featured={featured}
      footer={
        <div className="space-y-2">
          <ListingSearchEverywhereHint query={defaultQuery} />
          <p className="text-[15px] text-white/85">
            Zelf verkopen?{" "}
            <Link
              href="/voor-makers"
              className="font-semibold text-white underline underline-offset-4 hover:text-white"
            >
              Word maker op Hobbysalon
            </Link>
          </p>
        </div>
      }
    >
      <form method="GET" action="/creators" role="search">
        {Object.entries(hiddenFields).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}
        <ListingSearchShell
          id="creators-q"
          label="Filter creaties"
          placeholder="Filter op product, techniek of maker"
          defaultValue={defaultQuery}
        />
      </form>
    </FeaturedListingHero>
  );
}
