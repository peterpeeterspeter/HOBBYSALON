import { getCreatorBySlug } from "@/lib/platform/queries/creators";
import { listProductsByCreator } from "@/lib/platform/queries/products";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import type { Creator, Product, Domain } from "@/types/platform";

export type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

export type CreatorPageData = {
  creator: Creator | null;
  products: ProductWithPrice[];
  domains: Domain[];
  relatedWorkshops: { id: string; target_entity_id: string }[];
  relatedEvents: { id: string; target_entity_id: string }[];
};

export async function getCreatorPageData(slug: string): Promise<CreatorPageData> {
  const creator = await getCreatorBySlug(slug);
  if (!creator) {
    return {
      creator: null,
      products: [],
      domains: [],
      relatedWorkshops: [],
      relatedEvents: [],
    };
  }

  const [products, entityLinks, creatorDomains] = await Promise.all([
    listProductsByCreator(creator.id),
    getRelatedEntities("creator", creator.id),
    getCreatorDomains(creator.id),
  ]);

  const domains = creatorDomains;
  const relatedWorkshops = entityLinks
    .filter((l) => l.target_entity_type === "workshop")
    .map((l) => ({ id: l.id, target_entity_id: l.target_entity_id }));
  const relatedEvents = entityLinks
    .filter((l) => l.target_entity_type === "event")
    .map((l) => ({ id: l.id, target_entity_id: l.target_entity_id }));

  const productsWithPrices = await Promise.all(
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

  return {
    creator,
    products: productsWithPrices,
    domains,
    relatedWorkshops,
    relatedEvents,
  };
}

async function getCreatorDomains(creatorId: string): Promise<Domain[]> {
  const { createPlatformClient } = await import("@/lib/platform/client");
  const supabase = createPlatformClient();
  const { data: links } = await supabase
    .from("creator_domains")
    .select("domain_id")
    .eq("creator_id", creatorId);
  if (!links?.length) return [];

  const domainIds = links.map((l) => l.domain_id);
  const { data: domains } = await supabase
    .from("domains")
    .select("*")
    .in("id", domainIds)
    .eq("is_active", true);
  return (domains ?? []) as Domain[];
}
