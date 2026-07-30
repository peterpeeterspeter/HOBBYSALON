import {
  ListingHeroBand,
  ListingSearchShell,
} from "@/components/shared/ListingHeroBand";
import { ListingSearchEverywhereHint } from "@/components/shared/ListingSearchEverywhereHint";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";

type AgendaHeroProps = {
  hiddenFields?: Record<string, string | undefined>;
  defaultQuery?: string;
};

export function AgendaHero({ hiddenFields = {}, defaultQuery }: AgendaHeroProps) {
  return (
    <ListingHeroBand
      title="Ga eropuit voor je hobby"
      lead="Filter handmade markten, beurzen en open ateliers."
      imageSrc={LANDING_IMAGES.community}
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
    </ListingHeroBand>
  );
}
