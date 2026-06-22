import "server-only";

import { getMedusaAdminBackendConfig } from "./medusa-admin-auth";

export type CreatorOrderListItem = {
  id: string;
  display_id: number | null;
  created_at: string;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  email: string | null;
  currency_code: string | null;
  total: number | null;
  items?: Array<{
    id: string;
    title?: string | null;
    quantity?: number;
  }>;
};

type CreatorOrdersResponse = {
  orders: CreatorOrderListItem[];
  count: number;
  offset: number;
  limit: number;
};

export async function listCreatorOrders(input: {
  sellerId: string;
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<CreatorOrdersResponse | null> {
  const config = await getMedusaAdminBackendConfig();
  if (!config) return null;

  const url = new URL(
    `${config.baseUrl}/admin/platform/creators/${encodeURIComponent(
      input.sellerId
    )}/orders`
  );
  if (input.limit !== undefined) url.searchParams.set("limit", String(input.limit));
  if (input.offset !== undefined) url.searchParams.set("offset", String(input.offset));
  if (input.status?.trim()) url.searchParams.set("status", input.status.trim());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.adminToken}`,
      "x-medusa-access-token": config.adminToken,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json()) as CreatorOrdersResponse;
}

async function postOrderAction(
  sellerId: string,
  orderId: string,
  action: "complete" | "cancel"
): Promise<{ ok: boolean; error?: string }> {
  const config = await getMedusaAdminBackendConfig();
  if (!config) {
    return {
      ok: false,
      error: "Missing Medusa admin credentials on storefront server.",
    };
  }

  const response = await fetch(
    `${config.baseUrl}/admin/platform/creators/${encodeURIComponent(
      sellerId
    )}/orders/${encodeURIComponent(orderId)}/${action}`,
    {
      method: "POST",
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
      error: `Order ${action} failed (${response.status}): ${body || "unknown error"}`,
    };
  }

  return { ok: true };
}

export function completeCreatorOrder(
  sellerId: string,
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  return postOrderAction(sellerId, orderId, "complete");
}

export function cancelCreatorOrder(
  sellerId: string,
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  return postOrderAction(sellerId, orderId, "cancel");
}
