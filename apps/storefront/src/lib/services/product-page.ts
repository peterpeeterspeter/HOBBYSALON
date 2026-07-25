import {
  getProductBySlug,
  listProductsByCreator,
  listProductsByDomain,
  listProductsByIds,
} from "@/lib/platform/queries/products";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { getWorkshopById } from "@/lib/platform/queries/workshops";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { listArticlesByIds } from "@/lib/platform/queries/articles";
import { createPlatformClient } from "@/lib/platform/client";
import { getRelatedEntities } from "@/lib/platform/queries/entity-links";
import {
  getMedusaProduct,
  getMedusaProductByHandle,
} from "@/lib/commerce/medusa/products";
import type { Product, Domain, Workshop, Article, Event } from "@/types/platform";

export type ProductPageData = {
  product: Product | null;
  creator: Awaited<ReturnType<typeof getCreatorById>>;
  domain: Domain | null;
  price: { amount: number; currency_code: string } | null;
  variants: Array<{ id: string; title: string }>;
  relatedWorkshops: Workshop[];
  relatedSupplies: Product[];
  relatedArticles: Article[];
  relatedEvents: Event[];
};

function resolveListingPrice(
  product: Product,
  medusa: Awaited<ReturnType<typeof getMedusaProduct>>
): { amount: number; currency_code: string } | null {
  if (medusa?.calculated_price) {
    return {
      amount: medusa.calculated_price.calculated_amount,
      currency_code: medusa.calculated_price.currency_code,
    };
  }
  if (typeof product.price_cents === "number") {
    return {
      amount: product.price_cents,
      currency_code: (product.currency_code ?? "EUR").toLowerCase(),
    };
  }
  return null;
}

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
      relatedSupplies: [],
      relatedArticles: [],
      relatedEvents: [],
    };
  }

  const [creator, domain, entityLinks] = await Promise.all([
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
    getRelatedEntities("product", product.id),
  ]);

  // Handmade contact listings never auto-provision Medusa commerce products.
  const medusaById = product.medusa_product_id
    ? await getMedusaProduct(product.medusa_product_id)
    : null;
  const medusa =
    medusaById ??
    (product.product_type === "handmade" && !product.medusa_product_id
      ? null
      : await getMedusaProductByHandle(product.slug ?? null));

  const price = resolveListingPrice(product, medusa);
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
  const relatedArticleIds = entityLinks
    .filter((l) => l.target_entity_type === "article")
    .map((l) => l.target_entity_id);
  const relatedEventIds = entityLinks
    .filter((l) => l.target_entity_type === "event")
    .map((l) => l.target_entity_id);
  const relatedProductIds = entityLinks
    .filter((l) => l.target_entity_type === "product")
    .map((l) => l.target_entity_id);

  const [relatedArticles, relatedEvents, linkedProducts] = await Promise.all([
    listArticlesByIds(relatedArticleIds),
    listEventsByIds(relatedEventIds),
    listProductsByIds(relatedProductIds),
  ]);

  const domainSuppliesPromise =
    domain?.id && product.product_type === "handmade"
      ? listProductsByDomain(domain.id, "supply")
      : Promise.resolve([]);
  const creatorSuppliesPromise =
    creator?.id && product.product_type === "handmade"
      ? listProductsByCreator(creator.id)
      : Promise.resolve([]);

  const [domainSupplies, creatorProducts] = await Promise.all([
    domainSuppliesPromise,
    creatorSuppliesPromise,
  ]);

  const relatedSupplyMap = new Map<string, Product>();
  const allSupplyCandidates = [
    ...linkedProducts.filter((p) => p.product_type === "supply"),
    ...domainSupplies.filter((p) => p.product_type === "supply"),
    ...creatorProducts.filter((p) => p.product_type === "supply"),
  ];
  for (const candidate of allSupplyCandidates) {
    if (candidate.id === product.id) continue;
    if (!relatedSupplyMap.has(candidate.id)) {
      relatedSupplyMap.set(candidate.id, candidate);
    }
  }
  const relatedSupplies = Array.from(relatedSupplyMap.values()).slice(0, 8);

  return {
    product,
    creator: creator ?? null,
    domain: domain ?? null,
    price,
    variants,
    relatedWorkshops,
    relatedSupplies,
    relatedArticles,
    relatedEvents,
  };
}
