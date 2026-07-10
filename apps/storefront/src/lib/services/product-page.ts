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
import {
  createCreatorMarketplaceProduct,
  ensureCreatorProductSalesChannel,
} from "@/lib/commerce/medusa/creator-products";
import type { Product, Creator, Domain, Workshop, Article, Event } from "@/types/platform";

export type ProductPageData = {
  product: Product | null;
  creator: Creator | null;
  domain: Domain | null;
  price: { amount: number; currency_code: string } | null;
  variants: Array<{ id: string; title: string }>;
  relatedWorkshops: Workshop[];
  relatedSupplies: Product[];
  relatedArticles: Article[];
  relatedEvents: Event[];
};

const resolveLegacyCreatorRegistrationConfig = () => {
  const baseUrl =
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    "http://localhost:9000";
  const adminToken =
    process.env.MEDUSA_ADMIN_API_TOKEN ??
    process.env.MEDUSA_ADMIN_TOKEN ??
    process.env.MEDUSA_BACKEND_ADMIN_TOKEN;

  if (!adminToken) return null;

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    adminToken,
  };
};

const HANDMADE_FALLBACK_PRICE_CENTS = (() => {
  const parsed = Number.parseInt(
    process.env.HANDMADE_FALLBACK_PRICE_CENTS ?? "2500",
    10
  );
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 2500;
  }
  return parsed;
})();

async function resolveCreatorSellerId(creator: Creator): Promise<string | null> {
  const supabase = createPlatformClient();

  if (creator.user_id) {
    const { data: sellerLink } = await supabase
      .from("user_seller_links")
      .select("seller_id")
      .eq("user_id", creator.user_id)
      .eq("seller_type", "creator")
      .maybeSingle();

    if (sellerLink?.seller_id) {
      return sellerLink.seller_id as string;
    }
  }

  const config = resolveLegacyCreatorRegistrationConfig();
  if (!config) {
    return null;
  }

  const syntheticEmail = `legacy-${creator.id}@legacy.hobbysalon.local`;
  const response = await fetch(`${config.baseUrl}/admin/platform/creators/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.adminToken}`,
      "x-medusa-access-token": config.adminToken,
    },
    body: JSON.stringify({
      name: creator.display_name?.trim() || creator.slug || `Creator ${creator.id.slice(0, 8)}`,
      contact_name: creator.display_name?.trim() || null,
      email: syntheticEmail,
      city: creator.city ?? null,
      country_code: creator.country_code ?? "BE",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    creator?: { seller_id?: string };
  };

  return payload.creator?.seller_id ?? null;
}

async function ensurePurchasableMedusaProductId(
  product: Product,
  creator: Creator | null
): Promise<string | null> {
  if (
    product.medusa_product_id ||
    product.product_type !== "handmade" ||
    !creator
  ) {
    return product.medusa_product_id ?? null;
  }

  const sellerId = await resolveCreatorSellerId(creator);
  if (!sellerId) {
    return null;
  }

  const created = await createCreatorMarketplaceProduct({
    sellerId,
    platformCreatorId: creator.id,
    title: product.title,
    slug: product.slug,
    shortDescription: product.short_description,
    description: product.description,
    featuredImageUrl: product.featured_image_url,
    conditionType:
      (product.condition_type as "new" | "handmade" | "made_to_order" | "used" | null) ??
      "handmade",
    personalizationAvailable: product.personalization_available,
    estimatedDispatchDays: product.estimated_dispatch_days,
    platformDomainId: product.domain_id,
    platformCategoryId: product.category_id,
    isActive: product.is_active && product.status === "active",
    manageInventory: false,
    allowBackorder: true,
    priceCents: HANDMADE_FALLBACK_PRICE_CENTS,
    currencyCode: "EUR",
  });

  let medusaProductId = created.productId;

  if (!created.ok || !medusaProductId) {
    const existing = await getMedusaProductByHandle(product.slug ?? null);
    if (!existing?.id) {
      return null;
    }
    medusaProductId = existing.id;
  }

  await ensureCreatorProductSalesChannel(medusaProductId);

  const supabase = createPlatformClient();
  await supabase
    .from("products")
    .update({
      medusa_product_id: medusaProductId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id)
    .is("medusa_product_id", null);

  return medusaProductId;
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
  const medusaProductId =
    product.medusa_product_id ??
    (await ensurePurchasableMedusaProductId(product, creator ?? null));

  const medusaByResolvedId = medusaProductId
    ? await getMedusaProduct(medusaProductId)
    : null;
  const medusa = medusaByResolvedId ?? (await getMedusaProductByHandle(product.slug ?? null));

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
