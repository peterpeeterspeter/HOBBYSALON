import "server-only";

type CreatorProductInput = {
  sellerId: string;
  platformCreatorId: string;
  title: string;
  slug?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  featuredImageUrl?: string | null;
  isActive: boolean;
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
        is_active: input.isActive,
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
  isActive?: boolean;
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
        is_active: input.isActive,
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

  const payload = (await response.json()) as {
    product?: { id?: string };
  };

  return {
    ok: !!payload.product?.id,
    productId: payload.product?.id ?? input.medusaProductId,
  };
}
