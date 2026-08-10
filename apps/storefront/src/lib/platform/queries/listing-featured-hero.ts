import { publicAssetUrl } from "@/lib/media/public-asset-url";
import {
  formatHeroDate,
  formatHeroPrice,
  joinHeroMeta,
  pickDayStable,
  type FeaturedListingItem,
} from "@/lib/listing/featured-hero";
import { listAgendaEvents } from "@/lib/platform/queries/events";
import {
  listMaterialsCatalog,
  type MaterialsCatalogItem,
} from "@/lib/platform/queries/products";
import { listDiscoveryWorkshops } from "@/lib/platform/queries/workshops";

const HERO_POOL = 24;

type HeroCandidate = FeaturedListingItem & { featured: boolean };

function withImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return publicAssetUrl(trimmed) || trimmed;
}

function pickFromCandidates(candidates: HeroCandidate[]): FeaturedListingItem | null {
  if (candidates.length === 0) return null;
  const featured = candidates.filter((item) => item.featured);
  const pool = featured.length > 0 ? featured : candidates;
  const picked = pickDayStable(pool);
  if (!picked) return null;
  return {
    href: picked.href,
    imageUrl: picked.imageUrl,
    title: picked.title,
    meta: picked.meta,
    ctaLabel: picked.ctaLabel,
    kicker: picked.kicker,
  };
}

export async function pickWorkshopListingHero(): Promise<FeaturedListingItem | null> {
  const { workshops } = await listDiscoveryWorkshops({
    sort: "soon",
    limit: HERO_POOL,
    offset: 0,
  });

  const candidates: HeroCandidate[] = [];
  for (const workshop of workshops) {
    const imageUrl = withImageUrl(workshop.featured_image_url);
    if (!imageUrl) continue;
    const place =
      workshop.format_type === "online"
        ? "Online"
        : workshop.city?.trim() || workshop.location_name?.trim() || null;
    const price = formatHeroPrice(
      workshop.price_cents,
      workshop.currency_code ?? "EUR"
    );
    candidates.push({
      href: `/workshop/${workshop.slug}`,
      imageUrl,
      title: workshop.title,
      meta: joinHeroMeta([
        formatHeroDate(workshop.nextSession.startsAt),
        place,
        price,
      ]),
      ctaLabel: "Bekijk workshop",
      kicker: "Workshop in de kijker",
      featured: workshop.is_featured,
    });
  }

  return pickFromCandidates(candidates);
}

export async function pickEventListingHero(): Promise<FeaturedListingItem | null> {
  const { events } = await listAgendaEvents({
    upcoming_only: true,
    limit: HERO_POOL,
    offset: 0,
  });

  const candidates: HeroCandidate[] = [];
  for (const event of events) {
    const imageUrl = withImageUrl(event.featured_image_url);
    if (!imageUrl) continue;
    const place = event.city?.trim() || event.location_name?.trim() || null;
    const price = formatHeroPrice(
      event.ticket_price_cents,
      event.currency_code ?? "EUR"
    );
    candidates.push({
      href: `/agenda/${event.slug}`,
      imageUrl,
      title: event.title,
      meta: joinHeroMeta([formatHeroDate(event.starts_at), place, price]),
      ctaLabel: "Bekijk event",
      kicker: "Event in de kijker",
      featured: event.is_featured,
    });
  }

  return pickFromCandidates(candidates);
}

export async function pickMakerProductListingHero(): Promise<FeaturedListingItem | null> {
  const { products } = await listMaterialsCatalog({
    catalog_scope: "maker_p2p",
    sort: "recommended",
    limit: HERO_POOL,
    offset: 0,
  });

  const candidates: HeroCandidate[] = [];
  for (const product of products as MaterialsCatalogItem[]) {
    const imageUrl = withImageUrl(product.featured_image_url);
    if (!imageUrl) continue;
    const price = formatHeroPrice(
      product.displayPrice?.amount ?? product.price_cents,
      product.displayPrice?.currency_code ?? product.currency_code ?? "EUR"
    );
    candidates.push({
      href: `/product/${product.slug}`,
      imageUrl,
      title: product.title,
      meta: joinHeroMeta([
        product.creator_display_name?.trim() || null,
        product.offer?.badge || null,
        price,
      ]),
      ctaLabel: "Bekijk creatie",
      kicker: "Creatie in de kijker",
      featured: product.is_featured,
    });
  }

  return pickFromCandidates(candidates);
}
