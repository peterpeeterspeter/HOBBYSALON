import {
  ListingHeroBand,
  ListingSearchShell,
} from "@/components/shared/ListingHeroBand";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";

type AgendaHeroProps = {
  hiddenFields?: Record<string, string | undefined>;
  defaultQuery?: string;
};

export function AgendaHero({ hiddenFields = {}, defaultQuery }: AgendaHeroProps) {
  return (
    <ListingHeroBand
      title="Ga eropuit voor je hobby"
      lead="Handmade markten, beurzen en open ateliers. Plan een creatief uitje."
      imageSrc={LANDING_IMAGES.community}
    >
      <form method="GET" action="/agenda" role="search">
        {Object.entries(hiddenFields).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        )}
        <ListingSearchShell
          id="agenda-q"
          label="Zoek een event, plaats of hobby"
          placeholder="Zoek een event, plaats of hobby"
          defaultValue={defaultQuery}
        />
      </form>
    </ListingHeroBand>
  );
}
