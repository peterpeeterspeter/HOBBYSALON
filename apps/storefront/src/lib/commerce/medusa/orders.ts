import "server-only";

import { getAuthUser } from "@/lib/auth/session";
import { medusaAmountToCents } from "@/lib/commerce/money";

function getBackendUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    "http://localhost:9000"
  ).replace(/\/$/, "");
}

function getAdminToken(): string | null {
  return process.env.MEDUSA_ADMIN_API_TOKEN?.trim() || null;
}

export type BuyerOrderSummary = {
  id: string;
  display_id?: string | number | null;
  created_at: string;
  email: string | null;
  status: string;
  total_cents: number;
  currency_code: string;
  seller_order_count: number;
};

export type BuyerOrderDetail = BuyerOrderSummary & {
  orders: Array<{
    id: string;
    status: string;
    fulfillment_status?: string | null;
    payment_status?: string | null;
    total_cents: number;
    currency_code: string;
    items: Array<{
      id: string;
      title: string;
      quantity: number;
      unit_price_cents: number;
    }>;
  }>;
};

type AdminOrderSet = {
  id: string;
  display_id?: string | number | null;
  created_at?: string;
  customer?: { email?: string | null } | null;
  cart?: { email?: string | null } | null;
  orders?: Array<{
    id: string;
    email?: string | null;
    status?: string;
    fulfillment_status?: string | null;
    payment_status?: string | null;
    total?: number;
    currency_code?: string;
    items?: Array<{
      id: string;
      title?: string;
      quantity?: number;
      unit_price?: number;
    }>;
  }>;
};

function orderSetEmail(set: AdminOrderSet): string | null {
  const raw =
    set.customer?.email ??
    set.cart?.email ??
    set.orders?.[0]?.email ??
    null;
  return raw?.trim().toLowerCase() || null;
}

function summarize(set: AdminOrderSet): BuyerOrderSummary {
  const orders = set.orders ?? [];
  const currency = orders[0]?.currency_code ?? "eur";
  const totalMajor = orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
  const status =
    orders.every((o) => o.status === "canceled")
      ? "canceled"
      : orders.some((o) => o.payment_status === "captured")
        ? "paid"
        : (orders[0]?.status ?? "pending");

  return {
    id: set.id,
    display_id: set.display_id ?? null,
    created_at: set.created_at ?? new Date(0).toISOString(),
    email: orderSetEmail(set),
    status,
    total_cents: medusaAmountToCents(totalMajor),
    currency_code: currency,
    seller_order_count: orders.length,
  };
}

async function fetchAdminOrderSets(): Promise<AdminOrderSet[]> {
  const token = getAdminToken();
  if (!token) return [];

  const response = await fetch(`${getBackendUrl()}/admin/order-sets?limit=50`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { order_sets?: AdminOrderSet[] };
  return payload.order_sets ?? [];
}

async function fetchAdminOrderSet(id: string): Promise<AdminOrderSet | null> {
  const token = getAdminToken();
  if (!token) return null;

  const response = await fetch(`${getBackendUrl()}/admin/order-sets/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { order_set?: AdminOrderSet };
  return payload.order_set ?? null;
}

/**
 * List order sets owned by the authenticated Supabase user (email match).
 * Requires a verified session — email alone is never enough.
 */
export async function listBuyerOrdersForAuthUser(): Promise<BuyerOrderSummary[]> {
  const user = await getAuthUser();
  const email = user?.email?.trim().toLowerCase();
  if (!email) return [];

  const sets = await fetchAdminOrderSets();
  return sets
    .filter((set) => orderSetEmail(set) === email)
    .map(summarize)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

/**
 * Detail for one order set; returns null when missing or not owned by the auth user.
 */
export async function getBuyerOrderForAuthUser(
  orderSetId: string
): Promise<BuyerOrderDetail | null> {
  const user = await getAuthUser();
  const email = user?.email?.trim().toLowerCase();
  if (!email || !orderSetId) return null;

  const set = await fetchAdminOrderSet(orderSetId);
  if (!set || orderSetEmail(set) !== email) return null;

  const summary = summarize(set);
  return {
    ...summary,
    orders: (set.orders ?? []).map((order) => ({
      id: order.id,
      status: order.status ?? "pending",
      fulfillment_status: order.fulfillment_status ?? null,
      payment_status: order.payment_status ?? null,
      total_cents: medusaAmountToCents(Number(order.total ?? 0)),
      currency_code: order.currency_code ?? "eur",
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        title: item.title ?? "Artikel",
        quantity: item.quantity ?? 1,
        unit_price_cents: medusaAmountToCents(Number(item.unit_price ?? 0)),
      })),
    })),
  };
}

/** Success page: only treat as verified purchase when the order exists and matches the viewer. */
export async function verifyCheckoutSuccessOrder(
  orderSetId: string | undefined
): Promise<{ verified: boolean; order: BuyerOrderDetail | null }> {
  if (!orderSetId) return { verified: false, order: null };
  const order = await getBuyerOrderForAuthUser(orderSetId);
  if (order) return { verified: true, order };

  // Guest success: confirm the order set exists via admin, but do not expose
  // another buyer's details — only a generic verified flag with minimal fields.
  const set = await fetchAdminOrderSet(orderSetId);
  if (!set) return { verified: false, order: null };
  return { verified: true, order: null };
}
