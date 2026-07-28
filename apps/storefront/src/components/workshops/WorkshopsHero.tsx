import {
  ListingHeroBand,
  ListingSearchShell,
} from "@/components/shared/ListingHeroBand";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";

type WorkshopsHeroProps = {
  hiddenFields?: Record<string, string | undefined>;
  defaultQuery?: string;
};

export function WorkshopsHero({
  hiddenFields = {},
  defaultQuery,
}: WorkshopsHeroProps) {
  return (
    <ListingHeroBand
      title="Vind een workshop die bij je past"
      lead="Leer iets nieuws, dichtbij of online."
      imageSrc={LANDING_IMAGES.workshop}
    >
      <form method="GET" action="/workshops" role="search">
        {Object.entries(hiddenFields).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}
        <ListingSearchShell
          id="workshops-q"
          label="Wat wil je leren?"
          placeholder="Wat wil je leren? Bijvoorbeeld keramiek, haken of juwelen"
          defaultValue={defaultQuery}
        />
      </form>
    </ListingHeroBand>
  );
}
