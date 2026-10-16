import { getArticleBySlug, listArticlesByIds, listArticlesBySlugs } from "@/lib/platform/queries/articles";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { getWorkshopById } from "@/lib/platform/queries/workshops";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { listApprovedCommunityGalleryForArticle } from "@/lib/platform/queries/projects";
import { getEntityConnections } from "@/lib/platform/queries/entity-links";
import { listNextLearningPathArticleIds } from "@/lib/platform/queries/learning-paths";
import { createPlatformClient } from "@/lib/platform/client";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import {
  normalizeArticleGraphRelations,
  type OrderedArticleGraphItem,
} from "@/lib/content/article-graph-relations";
import type { Article, Creator, Event, Product, Workshop } from "@/types/platform";
import type { CommunityGalleryProject } from "@/lib/content/community-gallery";
import { extractArticleEditorialSlugs } from "@/lib/content/article-editorial-links";
import { parseArticleSourceMaterials, type ParsedArticleMaterial } from "@/lib/content/parse-article-materials";
import { getArticleMaterialOffers } from "@/lib/services/article-material-offers";
import type { SourceMaterialWithOffers } from "@/lib/content/article-material-offers";

export type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

export type GraphProduct = ProductWithPrice & {
  graph: Pick<OrderedArticleGraphItem, "sortOrder" | "weight">;
};

export type ArticlePageData = {
  article: Article | null;
  author: Creator | null;
  sourceMaterials: ParsedArticleMaterial[];
  sourceMaterialOffers: SourceMaterialWithOffers[];
  requiredMaterials: GraphProduct[];
  requiredTools: GraphProduct[];
  optionalMaterials: GraphProduct[];
  relatedProducts: GraphProduct[];
  nextSteps: Article[];
  relatedArticles: Article[];
  relatedWorkshops: Workshop[];
  relatedCreators: Creator[];
  relatedEvents: Event[];
  communityProjects: CommunityGalleryProject[];
};

async function getGraphProducts(items: OrderedArticleGraphItem[]): Promise<GraphProduct[]> {
  if (!items.length) return [];

  const supabase = createPlatformClient();
  const ids = [...new Set(items.map((item) => item.id))];
  const { data } = await supabase
    .from("products")
    .select("*")
    .in("id", ids)
    .eq("is_active", true)
    .eq("status", "active");

  const productsById = new Map((data ?? []).map((product) => [(product as Product).id, product as Product]));
  return Promise.all(
    items.flatMap((item) => {
      const product = productsById.get(item.id);
      if (!product) return [];
      return [
        (async (): Promise<GraphProduct> => {
          const medusa = await getMedusaProduct(product.medusa_product_id);
          const price = medusa?.calculated_price
            ? {
                amount: medusa.calculated_price.calculated_amount,
                currency_code: medusa.calculated_price.currency_code,
              }
            : null;
          return {
            ...product,
            price,
            graph: { sortOrder: item.sortOrder, weight: item.weight },
          };
        })(),
      ];
    })
  );
}

export async function getArticlePageData(slug: string): Promise<ArticlePageData> {
  const article = await getArticleBySlug(slug);
  if (!article) {
    return {
      article: null,
      author: null,
      sourceMaterials: [],
      sourceMaterialOffers: [],
      requiredMaterials: [],
      requiredTools: [],
      optionalMaterials: [],
      relatedProducts: [],
      nextSteps: [],
      relatedArticles: [],
      relatedWorkshops: [],
      relatedCreators: [],
      relatedEvents: [],
      communityProjects: [],
    };
  }

  const sourceMaterials = parseArticleSourceMaterials(article.body_markdown);
  const entityConnections = await getEntityConnections("article", article.id);
  const graphRelations = normalizeArticleGraphRelations(entityConnections);
  const editorialSlugs = extractArticleEditorialSlugs(article.body_markdown, article.slug);
  const relatedWorkshopIds = entityConnections
    .filter((connection) => connection.entityType === "workshop")
    .map((connection) => connection.entityId);
  const relatedCreatorIds = entityConnections
    .filter((connection) => connection.entityType === "creator")
    .map((connection) => connection.entityId);
  const relatedEventIds = entityConnections
    .filter((connection) => connection.entityType === "event")
    .map((connection) => connection.entityId);

  const [
    requiredMaterials,
    requiredTools,
    optionalMaterials,
    relatedProducts,
    learningPathNextStepIds,
    graphRelatedArticles,
    editorialArticles,
    relatedWorkshops,
    relatedCreators,
    relatedEvents,
    communityProjects,
    sourceMaterialOffers,
  ] = await Promise.all([
    getGraphProducts(graphRelations.requiredMaterials),
    getGraphProducts(graphRelations.requiredTools),
    getGraphProducts(graphRelations.optionalMaterials),
    getGraphProducts(graphRelations.relatedProducts),
    listNextLearningPathArticleIds(article.id),
    listArticlesByIds(graphRelations.relatedArticles.map((item) => item.id)),
    listArticlesBySlugs(editorialSlugs),
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
    listApprovedCommunityGalleryForArticle(article.id),
    getArticleMaterialOffers(sourceMaterials),
  ]);

  const nextStepIds =
    learningPathNextStepIds.length > 0
      ? learningPathNextStepIds
      : graphRelations.nextSteps.map((item) => item.id);
  const hydratedNextSteps = await listArticlesByIds(nextStepIds);
  const seenArticleIds = new Set([article.id]);
  const seenArticleSlugs = new Set([article.slug]);
  const uniquePublished = (candidate: Article): boolean => {
    if (!candidate.is_published || seenArticleIds.has(candidate.id) || seenArticleSlugs.has(candidate.slug)) return false;
    seenArticleIds.add(candidate.id);
    seenArticleSlugs.add(candidate.slug);
    return true;
  };
  const nextSteps = hydratedNextSteps.filter(uniquePublished);
  // Explicit approved graph order wins; body links only fill remaining slots.
  // Filter visibility/self/overlap before limiting, so missing rows waste no slots.
  const relatedArticles = [...graphRelatedArticles, ...editorialArticles]
    .filter(uniquePublished)
    .slice(0, 6);
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
    sourceMaterials,
    sourceMaterialOffers,
    requiredMaterials,
    requiredTools,
    optionalMaterials,
    relatedProducts,
    nextSteps,
    relatedArticles,
    relatedWorkshops,
    relatedCreators: [...creatorsById.values()],
    relatedEvents,
    communityProjects,
  };
}
