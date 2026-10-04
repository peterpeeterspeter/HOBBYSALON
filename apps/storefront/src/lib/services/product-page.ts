import {
  getProductBySlug,
  listProductsByCreator,
  listProductsByDomain,
  listProductsByIds,
} from "@/lib/platform/queries/products";
import { getCreatorById } from "@/lib/platform/queries/creators";
import { listWorkshopsByIds } from "@/lib/platform/queries/workshops";
import {
  listWorkshopIdsUsingProduct,
  listProjectIdsUsingProduct,
  listPublicProjectsByIds,
} from "@/lib/platform/queries/product-usage";
import { listEventsByIds } from "@/lib/platform/queries/events";
import { listArticlesByIds } from "@/lib/platform/queries/articles";
import { createPlatformClient } from "@/lib/platform/client";
import { getEntityConnections } from "@/lib/platform/queries/entity-links";
import {
  getMedusaProduct,
  getMedusaProductByHandle,
} from "@/lib/commerce/medusa/products";
import { medusaAmountToCents } from "@/lib/commerce/money";
import type { ExactVariantPriceInput } from "@/lib/commerce/variant-price";
import { publicAssetUrl, publicAssetUrls } from "@/lib/media/public-asset-url";
import type { Product, Creator, Domain, Workshop, Article, Event, Project } from "@/types/platform";

export type ProductPageData = {
  product: Product | null;
  creator: Creator | null;
  domain: Domain | null;
  price: { amount: number; currency_code: string } | null;
  variants: Array<{
    id: string;
    title: string;
    calculated_amount?: number;
    currency_code?: string;
    /** Unmodified commerce provenance for validated exact-link prices. */
    exact_price?: ExactVariantPriceInput | null;
  }>;
  galleryImages: string[];
  relatedWorkshops: Workshop[];
  relatedSupplies: Product[];
  relatedArticles: Article[];
  relatedEvents: Event[];
  relatedProjects: Project[];
};

const MAKER_LISTING_TYPES = new Set(["handmade", "destash"]);

function isMakerListing(product: Product): boolean {
  return MAKER_LISTING_TYPES.has(product.product_type);
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
      galleryImages: [],
      relatedWorkshops: [] as Workshop[],
      relatedSupplies: [],
      relatedArticles: [],
      relatedEvents: [],
      relatedProjects: [],
    };
  }

  const [creator, domain, entityConnections, galleryResult] = await Promise.all([
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
    getEntityConnections("product", product.id),
    createPlatformClient()
      .from("product_gallery_images")
      .select("image_url")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true }),
  ]);
  const galleryImages = publicAssetUrls(
    ((galleryResult.data ?? []) as Array<{ image_url: string }>).map(
      (row) => row.image_url
    )
  );
  // Maker listings (handmade/destash) are platform-only: price is an
  // indicative asking price from products.price_cents, not a Medusa
  // checkout price. A maker listing created before this cutover may still
  // carry a medusa_product_id - that legacy row keeps its Medusa cart/price
  // behavior so in-flight orders aren't broken.
  const hasLegacyMedusaListing = isMakerListing(product) && !!product.medusa_product_id;
  const useMedusaCommerce = product.product_type === "supply" || hasLegacyMedusaListing;

  let price: { amount: number; currency_code: string } | null = null;
  let variants: Array<{
    id: string;
    title: string;
    calculated_amount?: number;
    currency_code?: string;
    exact_price?: ExactVariantPriceInput | null;
  }> = [];

  if (useMedusaCommerce) {
    const medusaProductId = product.medusa_product_id;
    const medusaByResolvedId = medusaProductId
      ? await getMedusaProduct(medusaProductId)
      : null;
    const medusa =
      medusaByResolvedId ?? (await getMedusaProductByHandle(product.slug ?? null));

    variants =
      medusa?.variants?.map((v) => ({
        id: v.id,
        title: v.title,
        calculated_amount: v.calculated_price?.calculated_amount,
        currency_code: v.calculated_price?.currency_code ?? "EUR",
        exact_price: v.calculated_price,
      })) ?? [];

    const firstPriced = variants.find((v) => v.calculated_amount != null);
    price = firstPriced?.calculated_amount != null
      ? {
          amount: medusaAmountToCents(firstPriced.calculated_amount),
          currency_code: firstPriced.currency_code ?? "EUR",
        }
      : medusa?.calculated_price
        ? {
            amount: medusaAmountToCents(
              medusa.calculated_price.calculated_amount
            ),
            currency_code: medusa.calculated_price.currency_code,
          }
        : null;
  } else if (isMakerListing(product) && typeof product.price_cents === "number") {
    price = {
      amount: product.price_cents,
      currency_code: product.currency_code ?? "EUR",
    };
  }

  // Explicit saved usage comes first; graph neighbors remain recommendations.
  // Never derive a cart, bundle, or new material requirement on this page.
  const [usageWorkshopIds, usageProjectIds] = await Promise.all([
    listWorkshopIdsUsingProduct(product.id),
    listProjectIdsUsingProduct(product.id),
  ]);
  const workshopIds = [...new Set([
    ...usageWorkshopIds,
    ...entityConnections.filter((l) => l.entityType === "workshop").map((l) => l.entityId),
  ])];
  const projectIds = [...new Set([
    ...usageProjectIds,
    ...entityConnections.filter((l) => l.entityType === "project").map((l) => l.entityId),
  ])];
  const [relatedWorkshops, relatedProjects] = await Promise.all([
    listWorkshopsByIds(workshopIds),
    listPublicProjectsByIds(projectIds),
  ]);
  const relatedArticleIds = entityConnections
    .filter((l) => l.entityType === "article")
    .map((l) => l.entityId);
  const relatedEventIds = entityConnections
    .filter((l) => l.entityType === "event")
    .map((l) => l.entityId);
  const relatedProductIds = entityConnections
    .filter((l) => l.entityType === "product")
    .map((l) => l.entityId);

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

  const normalizedProduct: Product = {
    ...product,
    featured_image_url: publicAssetUrl(product.featured_image_url),
  };

  const relatedSupplyMap = new Map<string, Product>();
  const allSupplyCandidates = [
    ...linkedProducts.filter((p) => p.product_type === "supply"),
    ...domainSupplies.filter((p) => p.product_type === "supply"),
    ...creatorProducts.filter((p) => p.product_type === "supply"),
  ];
  for (const candidate of allSupplyCandidates) {
    if (candidate.id === normalizedProduct.id) continue;
    if (!relatedSupplyMap.has(candidate.id)) {
      relatedSupplyMap.set(candidate.id, {
        ...candidate,
        featured_image_url: publicAssetUrl(candidate.featured_image_url),
      });
    }
  }
  const relatedSupplies = Array.from(relatedSupplyMap.values()).slice(0, 8);

  return {
    product: normalizedProduct,
    creator: creator ?? null,
    domain: domain ?? null,
    price,
    variants,
    galleryImages,
    relatedWorkshops,
    relatedSupplies,
    relatedArticles,
    relatedEvents,
    relatedProjects,
  };
}
