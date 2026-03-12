import "server-only";

type CreatorProductInput = {
  sellerId: string;
  platformCreatorId: string;
  title: string;
  slug?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  featuredImageUrl?: string | null;
  platformDomainId?: string | null;
  platformCategoryId?: string | null;
  isActive: boolean;
  priceCents: number;
  currencyCode?: string | null;
};

type CreatorProductResult = {
  ok: boolean;
  productId: string | null;
  error?: string;
};

function getAdminConfig() {
  const baseUrl =
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    "http://localhost:9000";
  const adminToken =
    process.env.MEDUSA_ADMIN_API_TOKEN ??
    process.env.MEDUSA_ADMIN_TOKEN ??
    process.env.MEDUSA_BACKEND_ADMIN_TOKEN;

  if (!adminToken) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    adminToken,
  };
}

export async function createCreatorMarketplaceProduct(
  input: CreatorProductInput
): Promise<CreatorProductResult> {
  const config = getAdminConfig();
  if (!config) {
    return {
      ok: false,
      productId: null,
      error: "Missing MEDUSA_ADMIN_API_TOKEN on storefront server.",
    };
  }

  const response = await fetch(
    `${config.baseUrl}/admin/platform/creators/${encodeURIComponent(
      input.sellerId
    )}/products`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.adminToken}`,
        "x-medusa-access-token": config.adminToken,
      },
      body: JSON.stringify({
        title: input.title.trim(),
        slug: input.slug?.trim() || null,
        short_description: input.shortDescription?.trim() || null,
        description: input.description?.trim() || null,
        featured_image_url: input.featuredImageUrl?.trim() || null,
        platform_domain_id: input.platformDomainId ?? null,
        platform_category_id: input.platformCategoryId ?? null,
        is_active: input.isActive,
        price_cents: input.priceCents,
        currency_code: (input.currencyCode?.trim() || "EUR").toLowerCase(),
        platform_creator_id: input.platformCreatorId,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      productId: null,
      error: `Creator product create failed (${response.status}): ${body || "unknown error"}`,
    };
  }

  await queueProjectionSync(config.baseUrl, config.adminToken, input.sellerId);

  const payload = (await response.json()) as {
    product?: { id?: string };
  };

  return {
    ok: !!payload.product?.id,
    productId: payload.product?.id ?? null,
  };
}

export async function updateCreatorMarketplaceProduct(input: {
  sellerId: string;
  medusaProductId: string;
  platformCreatorId: string;
  title?: string | null;
  slug?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  featuredImageUrl?: string | null;
  platformDomainId?: string | null;
  platformCategoryId?: string | null;
  isActive?: boolean;
  priceCents?: number;
  currencyCode?: string | null;
}): Promise<CreatorProductResult> {
  const config = getAdminConfig();
  if (!config) {
    return {
      ok: false,
      productId: null,
      error: "Missing MEDUSA_ADMIN_API_TOKEN on storefront server.",
    };
  }

  const response = await fetch(
    `${config.baseUrl}/admin/platform/creators/${encodeURIComponent(
      input.sellerId
    )}/products/${encodeURIComponent(input.medusaProductId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.adminToken}`,
        "x-medusa-access-token": config.adminToken,
      },
      body: JSON.stringify({
        title: input.title?.trim(),
        slug: input.slug?.trim() || null,
        short_description: input.shortDescription?.trim() || null,
        description: input.description?.trim() || null,
        featured_image_url: input.featuredImageUrl?.trim() || null,
        platform_domain_id: input.platformDomainId ?? null,
        platform_category_id: input.platformCategoryId ?? null,
        is_active: input.isActive,
        price_cents:
          typeof input.priceCents === "number" && Number.isFinite(input.priceCents)
            ? input.priceCents
            : undefined,
        currency_code:
          typeof input.currencyCode === "string" && input.currencyCode.trim()
            ? input.currencyCode.trim().toLowerCase()
            : undefined,
        platform_creator_id: input.platformCreatorId,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      productId: null,
      error: `Creator product update failed (${response.status}): ${body || "unknown error"}`,
    };
  }

  await queueProjectionSync(config.baseUrl, config.adminToken, input.sellerId);

  const payload = (await response.json()) as {
    product?: { id?: string };
  };

  return {
    ok: !!payload.product?.id,
    productId: payload.product?.id ?? input.medusaProductId,
  };
}

async function queueProjectionSync(
  baseUrl: string,
  adminToken: string,
  sellerId: string
): Promise<void> {
  try {
    await fetch(`${baseUrl}/admin/platform/products/projection/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
        "x-medusa-access-token": adminToken,
      },
      body: JSON.stringify({
        seller_id: sellerId,
        limit: 250,
      }),
      cache: "no-store",
    });
  } catch {
    // Best-effort only; projection still happens via event subscribers.
  }
}
