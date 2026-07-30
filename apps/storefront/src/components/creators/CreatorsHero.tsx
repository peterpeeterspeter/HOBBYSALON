import Link from "next/link";
import {
  ListingHeroBand,
  ListingSearchShell,
} from "@/components/shared/ListingHeroBand";
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
      lead="Handgemaakte creaties en restanten van makers. Geen webshopvoorraad, wel persoonlijke aanbiedingen."
      imageSrc={LANDING_IMAGES.community}
      footer={
        <p className="text-[15px] text-white/85">
          Zelf verkopen?{" "}
          <Link
            href="/voor-makers"
            className="font-semibold text-white underline underline-offset-4 hover:text-white"
          >
            Word maker op Hobbysalon
          </Link>
        </p>
      }
    >
      <form method="GET" action="/creators" role="search">
        {Object.entries(hiddenFields).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}
        <ListingSearchShell
          id="creators-q"
          label="Zoek creaties"
          placeholder="Zoek op product, techniek of maker"
          defaultValue={defaultQuery}
        />
      </form>
    </ListingHeroBand>
  );
}
