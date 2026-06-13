import "server-only";

type CreatorProductInput = {
  sellerId: string;
  platformCreatorId: string;
  title: string;
  slug?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  featuredImageUrl?: string | null;
  conditionType?: "new" | "handmade" | "made_to_order" | "used" | null;
  personalizationAvailable?: boolean;
  estimatedDispatchDays?: number | null;
  platformDomainId?: string | null;
  platformCategoryId?: string | null;
  isActive: boolean;
  manageInventory?: boolean;
  allowBackorder?: boolean;
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
    process.env.MEDUSA_ADMIN_API_TOKEN?.trim() ||
    process.env.MEDUSA_ADMIN_TOKEN?.trim() ||
    process.env.MEDUSA_BACKEND_ADMIN_TOKEN?.trim();

  if (!adminToken) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    adminToken,
  };
}

async function resolveDefaultSalesChannelId(
  baseUrl: string,
  adminToken: string
): Promise<string | null> {
  const response = await fetch(`${baseUrl}/admin/sales-channels?limit=5`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "x-medusa-access-token": adminToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    sales_channels?: Array<{ id: string; name?: string }>;
  };

  const channels = payload.sales_channels ?? [];
  return (
    channels.find((channel) => channel.name === "Default Sales Channel")?.id ??
    channels[0]?.id ??
    null
  );
}

export async function ensureCreatorProductSalesChannel(
  productId: string
): Promise<boolean> {
  const config = getAdminConfig();
  if (!config) {
    return false;
  }

  const salesChannelId = await resolveDefaultSalesChannelId(
    config.baseUrl,
    config.adminToken
  );
  if (!salesChannelId) {
    return false;
  }

  const response = await fetch(`${config.baseUrl}/admin/products/${productId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.adminToken}`,
      "x-medusa-access-token": config.adminToken,
    },
    body: JSON.stringify({
      sales_channels: [{ id: salesChannelId }],
    }),
    cache: "no-store",
  });

  return response.ok;
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
        condition_type: input.conditionType ?? null,
        personalization_available: !!input.personalizationAvailable,
        estimated_dispatch_days: input.estimatedDispatchDays ?? null,
        platform_domain_id: input.platformDomainId ?? null,
        platform_category_id: input.platformCategoryId ?? null,
        is_active: input.isActive,
        manage_inventory: !!input.manageInventory,
        allow_backorder:
          input.allowBackorder === undefined ? true : !!input.allowBackorder,
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
  conditionType?: "new" | "handmade" | "made_to_order" | "used" | null;
  personalizationAvailable?: boolean;
  estimatedDispatchDays?: number | null;
  platformDomainId?: string | null;
  platformCategoryId?: string | null;
  isActive?: boolean;
  manageInventory?: boolean;
  allowBackorder?: boolean;
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
        condition_type:
          input.conditionType === undefined ? undefined : input.conditionType,
        personalization_available:
          typeof input.personalizationAvailable === "boolean"
            ? input.personalizationAvailable
            : undefined,
        estimated_dispatch_days:
          input.estimatedDispatchDays === undefined
            ? undefined
            : input.estimatedDispatchDays,
        platform_domain_id:
          input.platformDomainId === undefined ? undefined : input.platformDomainId,
        platform_category_id:
          input.platformCategoryId === undefined
            ? undefined
            : input.platformCategoryId,
        is_active: input.isActive,
        manage_inventory:
          typeof input.manageInventory === "boolean"
            ? input.manageInventory
            : undefined,
        allow_backorder:
          typeof input.allowBackorder === "boolean"
            ? input.allowBackorder
            : undefined,
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

export async function deleteCreatorMarketplaceProduct(input: {
  sellerId: string;
  medusaProductId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const config = getAdminConfig();
  if (!config) {
    return {
      ok: false,
      error: "Missing MEDUSA_ADMIN_API_TOKEN on storefront server.",
    };
  }

  const response = await fetch(
    `${config.baseUrl}/admin/platform/creators/${encodeURIComponent(
      input.sellerId
    )}/products/${encodeURIComponent(input.medusaProductId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.adminToken}`,
        "x-medusa-access-token": config.adminToken,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      error: `Creator product delete failed (${response.status}): ${body || "unknown error"}`,
    };
  }

  await queueProjectionSync(config.baseUrl, config.adminToken, input.sellerId);
  return { ok: true };
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
