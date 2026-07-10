import { getArticleBySlug } from "@/lib/platform/queries/articles";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { getWorkshopById } from "@/lib/platform/queries/workshops";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { getEntityConnections } from "@/lib/platform/queries/entity-links";
import { createPlatformClient } from "@/lib/platform/client";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import type { Article, Creator, Event, Product, Workshop } from "@/types/platform";

export type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

export type ArticlePageData = {
  article: Article | null;
  author: Creator | null;
  relatedProducts: ProductWithPrice[];
  relatedWorkshops: Workshop[];
  relatedCreators: Creator[];
  relatedEvents: Event[];
};

export async function getArticlePageData(slug: string): Promise<ArticlePageData> {
  const article = await getArticleBySlug(slug);
  if (!article) {
    return {
      article: null,
      author: null,
      relatedProducts: [],
      relatedWorkshops: [],
      relatedCreators: [],
      relatedEvents: [],
    };
  }

  const entityConnections = await getEntityConnections("article", article.id);
  const relatedProductIds = entityConnections
    .filter((connection) => connection.entityType === "product")
    .map((connection) => connection.entityId);
  const relatedWorkshopIds = entityConnections
    .filter((connection) => connection.entityType === "workshop")
    .map((connection) => connection.entityId);
  const relatedCreatorIds = entityConnections
    .filter((connection) => connection.entityType === "creator")
    .map((connection) => connection.entityId);
  const relatedEventIds = entityConnections
    .filter((connection) => connection.entityType === "event")
    .map((connection) => connection.entityId);

  const supabase = createPlatformClient();
  let relatedProducts: Product[] = [];
  if (relatedProductIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("*")
      .in("id", [...new Set(relatedProductIds)])
      .eq("is_active", true)
      .eq("status", "active");
    relatedProducts = (data ?? []) as Product[];
  }

  const relatedProductsWithPrices = await Promise.all(
    relatedProducts.map(async (product) => {
      const medusa = await getMedusaProduct(product.medusa_product_id);
      const price = medusa?.calculated_price
        ? {
            amount: medusa.calculated_price.calculated_amount,
            currency_code: medusa.calculated_price.currency_code,
          }
        : null;
      return { ...product, price };
    })
  );

  const [relatedWorkshops, relatedCreators, relatedEvents] = await Promise.all([
    relatedWorkshopIds.length > 0
      ? (
          await Promise.all(
            [...new Set(relatedWorkshopIds)].map((id) => getWorkshopById(id))
          )
        ).filter((workshop): workshop is Workshop => workshop != null)
      : [],
    relatedCreatorIds.length > 0
      ? (
          await Promise.all(
            [...new Set(relatedCreatorIds)].map((id) => getCreatorById(id))
          )
        ).filter((creator): creator is Creator => creator != null)
      : [],
    listEventsByIds(relatedEventIds),
  ]);

  const author = article.author_creator_id
    ? await getCreatorById(article.author_creator_id)
    : null;

  const creatorsById = new Map(
    [...relatedCreators, author].filter((creator): creator is Creator => creator != null).map(
      (creator) => [creator.id, creator]
    )
  );

  return {
    article,
    author: author ?? null,
    relatedProducts: relatedProductsWithPrices,
    relatedWorkshops,
    relatedCreators: [...creatorsById.values()],
    relatedEvents,
  };
}
