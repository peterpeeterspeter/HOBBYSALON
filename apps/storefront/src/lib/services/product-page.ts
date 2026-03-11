import { getProductBySlug } from "@/lib/platform/queries/products";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { getWorkshopById } from "@/lib/platform/queries/workshops";
import { createPlatformClient } from "@/lib/platform/client";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import type { Product, Creator, Domain, Workshop } from "@/types/platform";

export type ProductPageData = {
  product: Product | null;
  creator: Creator | null;
  domain: Domain | null;
  price: { amount: number; currency_code: string } | null;
  variants: Array<{ id: string; title: string }>;
  relatedWorkshops: Workshop[];
  relatedArticles: { id: string; target_entity_id: string }[];
  relatedEvents: { id: string; target_entity_id: string }[];
};

export async function getProductPageData(slug: string): Promise<ProductPageData> {
  const product = await getProductBySlug(slug);
  if (!product) {
    return {
      product: null,
      creator: null,
      domain: null,
      price: null,
      variants: [],
      relatedWorkshops: [] as Workshop[],
      relatedArticles: [],
      relatedEvents: [],
    };
  }

  const [creator, domain, medusa, entityLinks] = await Promise.all([
    product.creator_id ? getCreatorById(product.creator_id) : Promise.resolve(null),
    product.domain_id
      ? (async () => {
          const supabase = createPlatformClient();
          const { data } = await supabase
            .from("domains")
            .select("*")
            .eq("id", product.domain_id)
            .single();
          return data as Domain | null;
        })()
      : Promise.resolve(null),
    getMedusaProduct(product.medusa_product_id),
    getRelatedEntities("product", product.id),
  ]);

  const price = medusa?.calculated_price
    ? {
        amount: medusa.calculated_price.calculated_amount,
        currency_code: medusa.calculated_price.currency_code,
      }
    : null;

  const variants =
    medusa?.variants?.map((v) => ({ id: v.id, title: v.title })) ?? [];

  const workshopIds = entityLinks
    .filter((l) => l.target_entity_type === "workshop")
    .map((l) => l.target_entity_id);
  const relatedWorkshops =
    workshopIds.length > 0
      ? (
          await Promise.all(
            workshopIds.map((id) => getWorkshopById(id))
          )
        ).filter((w): w is Workshop => w != null)
      : [];
  const relatedArticles = entityLinks
    .filter((l) => l.target_entity_type === "article")
    .map((l) => ({ id: l.id, target_entity_id: l.target_entity_id }));
  const relatedEvents = entityLinks
    .filter((l) => l.target_entity_type === "event")
    .map((l) => ({ id: l.id, target_entity_id: l.target_entity_id }));

  return {
    product,
    creator: creator ?? null,
    domain: domain ?? null,
    price,
    variants,
    relatedWorkshops,
    relatedArticles,
    relatedEvents,
  };
}
