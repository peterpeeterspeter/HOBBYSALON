import Link from "next/link";
import {
  ListingHeroBand,
  ListingSearchShell,
} from "@/components/shared/ListingHeroBand";
import { ListingSearchEverywhereHint } from "@/components/shared/ListingSearchEverywhereHint";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";

type CreatorsHeroProps = {
  hiddenFields?: Record<string, string | undefined>;
  defaultQuery?: string;
};

export function CreatorsHero({
  hiddenFields = {},
  defaultQuery,
}: CreatorsHeroProps) {
  return (
    <ListingHeroBand
      title="Koop rechtstreeks van makers"
      lead="Filter handgemaakte creaties en restanten van makers."
      imageSrc={LANDING_IMAGES.community}
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
    </ListingHeroBand>
  );
}
