import { getDomainBySlug } from "@/lib/platform/queries/domains";
import { listCreatorsByDomain } from "@/lib/platform/queries/creators";
import { listProductsByDomain } from "@/lib/platform/queries/products";
import { listWorkshopsByDomain } from "@/lib/platform/queries/workshops";
import { listEvents } from "@/lib/platform/queries/events";
import { listArticlesByDomain } from "@/lib/platform/queries/articles";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import type { Domain, Creator, Product, Workshop, Event, Article } from "@/types/platform";

export type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

export type DomainPageData = {
  domain: Domain | null;
  creators: Creator[];
  handmadeProducts: ProductWithPrice[];
  supplyProducts: ProductWithPrice[];
  workshops: Workshop[];
  events: Event[];
  articles: Article[];
  relatedWorkshops: { id: string; target_entity_id: string }[];
  relatedEvents: { id: string; target_entity_id: string }[];
  relatedArticles: { id: string; target_entity_id: string }[];
};

export async function getDomainPageData(slug: string): Promise<DomainPageData> {
  const domain = await getDomainBySlug(slug);
  if (!domain) {
    return {
      domain: null,
      creators: [],
      handmadeProducts: [],
      supplyProducts: [],
      workshops: [],
      events: [],
      articles: [],
      relatedWorkshops: [],
      relatedEvents: [],
      relatedArticles: [],
    };
  }

  const fromDate = new Date().toISOString();
  const [creators, handmadeProducts, supplyProducts, workshops, events, articles, entityLinks] =
    await Promise.all([
      listCreatorsByDomain(domain.id),
      listProductsByDomain(domain.id, "handmade"),
      listProductsByDomain(domain.id, "supply"),
      listWorkshopsByDomain(domain.id),
      listEvents({ domain_id: domain.id, from_date: fromDate }),
      listArticlesByDomain(domain.id),
      getRelatedEntities("domain", domain.id),
    ]);

  const relatedWorkshops = entityLinks
    .filter((l) => l.target_entity_type === "workshop")
    .map((l) => ({ id: l.id, target_entity_id: l.target_entity_id }));
  const relatedEvents = entityLinks
    .filter((l) => l.target_entity_type === "event")
    .map((l) => ({ id: l.id, target_entity_id: l.target_entity_id }));
  const relatedArticles = entityLinks
    .filter((l) => l.target_entity_type === "article")
    .map((l) => ({ id: l.id, target_entity_id: l.target_entity_id }));

  const handmadeWithPrices = await enrichProductsWithPrices(handmadeProducts);
  const supplyWithPrices = await enrichProductsWithPrices(supplyProducts);

  return {
    domain,
    creators,
    handmadeProducts: handmadeWithPrices,
    supplyProducts: supplyWithPrices,
    workshops,
    events,
    articles,
    relatedWorkshops,
    relatedEvents,
    relatedArticles,
  };
}

async function enrichProductsWithPrices(
  products: Product[]
): Promise<ProductWithPrice[]> {
  const results = await Promise.all(
    products.map(async (p) => {
      const medusa = await getMedusaProduct(p.medusa_product_id);
      const price = medusa?.calculated_price
        ? {
            amount: medusa.calculated_price.calculated_amount,
            currency_code: medusa.calculated_price.currency_code,
          }
        : null;
      return { ...p, price };
    })
  );
  return results;
}
