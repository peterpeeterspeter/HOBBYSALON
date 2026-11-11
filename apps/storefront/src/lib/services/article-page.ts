import { getArticleBySlug, listArticlesByIds, listArticlesBySlugs, listRecentHubArticlesByDomain } from "@/lib/platform/queries/articles";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { getWorkshopById, listWorkshopsByDomain } from "@/lib/platform/queries/workshops";
import { listProductsByDomain } from "@/lib/platform/queries/products";
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
  /** Extra photos for articles of workshop hosts, shops and editors. */
  galleryImages?: string[];
};

/** Gallery photos of one article; an error never breaks the page. */
async function listArticleGalleryImages(articleId: string): Promise<string[]> {
  try {
    const { data } = await createPlatformClient()
      .from("article_gallery_images")
      .select("image_url")
      .eq("article_id", articleId)
      .order("sort_order", { ascending: true });
    return ((data ?? []) as Array<{ image_url: string }>).map((row) => row.image_url);
  } catch {
    return [];
  }
}

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

async function hydrateById<T>(
  ids: string[],
  load: (id: string) => Promise<T | null>
): Promise<T[]> {
  if (!ids.length) return [];
  return (
    await Promise.all([...new Set(ids)].map((id) => load(id)))
  ).filter((row): row is T => row != null);
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
    graphWorkshops,
    relatedCreators,
    relatedEvents,
    communityProjects,
    sourceMaterialOffers,
    author,
    galleryImages,
  ] = await Promise.all([
    getGraphProducts(graphRelations.requiredMaterials),
    getGraphProducts(graphRelations.requiredTools),
    getGraphProducts(graphRelations.optionalMaterials),
    getGraphProducts(graphRelations.relatedProducts),
    listNextLearningPathArticleIds(article.id),
    listArticlesByIds(graphRelations.relatedArticles.map((item) => item.id)),
    listArticlesBySlugs(editorialSlugs),
    hydrateById(relatedWorkshopIds, getWorkshopById),
    hydrateById(relatedCreatorIds, getCreatorById),
    listEventsByIds(relatedEventIds),
    listApprovedCommunityGalleryForArticle(article.id),
    getArticleMaterialOffers(sourceMaterials),
    article.author_creator_id ? getCreatorById(article.author_creator_id) : Promise.resolve(null),
    listArticleGalleryImages(article.id),
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
  // Approved graph order wins; editorial body links fill next. Domain fill is capped and slim.
  const seededArticleCount = [...graphRelatedArticles, ...editorialArticles].filter(
    (candidate) =>
      candidate.is_published &&
      candidate.id !== article.id &&
      candidate.slug !== article.slug
  ).length;
  const needDomainArticles = Boolean(article.domain_id) && seededArticleCount < 6;
  const needDomainWorkshops = Boolean(article.domain_id) && graphWorkshops.length < 4;
  const needDomainProducts = Boolean(article.domain_id) && relatedProducts.length < 8;

  const [domainArticles, domainWorkshops, domainSupplyProducts] = await Promise.all([
    needDomainArticles
      ? listRecentHubArticlesByDomain(article.domain_id!, 8)
      : Promise.resolve([]),
    needDomainWorkshops
      ? listWorkshopsByDomain(article.domain_id!, { limit: 8 })
      : Promise.resolve([]),
    needDomainProducts
      ? listProductsByDomain(article.domain_id!, "supply", 8).then((products) =>
          getGraphProducts(
            products.map((product, index) => ({ id: product.id, sortOrder: index, weight: 0 }))
          )
        )
      : Promise.resolve([]),
  ]);

  const relatedArticles = [...graphRelatedArticles, ...editorialArticles, ...domainArticles]
    .filter(uniquePublished)
    .slice(0, 6);
  const seenWorkshopIds = new Set<string>();
  const relatedWorkshops = [...graphWorkshops, ...domainWorkshops]
    .filter((workshop) => {
      if (seenWorkshopIds.has(workshop.id)) return false;
      seenWorkshopIds.add(workshop.id);
      return true;
    })
    .slice(0, 4);
  const shownProductIds = new Set(
    [...requiredMaterials, ...requiredTools, ...optionalMaterials, ...relatedProducts].map(
      (product) => product.id
    )
  );
  const relatedShopProducts = [
    ...relatedProducts,
    ...domainSupplyProducts.filter((product) => !shownProductIds.has(product.id)),
  ].slice(0, 8);

  const creatorsById = new Map(
    [...relatedCreators, author].filter((creator): creator is Creator => creator != null).map(
      (creator) => [creator.id, creator]
    )
  );

  return {
    article,
    author: author ?? null,
    galleryImages,
    sourceMaterials,
    sourceMaterialOffers,
    requiredMaterials,
    requiredTools,
    optionalMaterials,
    relatedProducts: relatedShopProducts,
    nextSteps,
    relatedArticles,
    relatedWorkshops,
    relatedCreators: [...creatorsById.values()],
    relatedEvents,
    communityProjects,
  };
}
