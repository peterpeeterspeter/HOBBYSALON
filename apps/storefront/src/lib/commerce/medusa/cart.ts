import { sdk } from "./client";
import { getCartItemSellerId } from "../payment-gate";

const getBackendUrl = () =>
  process.env.MEDUSA_BACKEND_URL ??
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  "http://localhost:9000";

const CART_COOKIE_NAME = "medusa_cart_id";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export { CART_COOKIE_NAME, CART_COOKIE_MAX_AGE };

type CartLineMetadata = Record<string, unknown>;

export type CartAddError = {
  kind: "cart_not_found" | "cart_completed" | "inventory" | "validation" | "transport" | "unknown";
  status?: number;
  type?: string;
  code?: string;
};

type CartAddResult =
  | { success: true; cart_id: string }
  | { success: false; message: string; error: CartAddError };

export function isStaleCartError(error: CartAddError): boolean {
  return error.kind === "cart_not_found" || error.kind === "cart_completed";
}

function readCartError(error: unknown) {
  const err = error as {
    message?: string; status?: number; type?: string; code?: string;
    response?: { status?: number; data?: { message?: string; type?: string; code?: string } };
  } | null;
  return {
    status: err?.response?.status ?? err?.status,
    type: err?.response?.data?.type ?? err?.type,
    code: err?.response?.data?.code ?? err?.code,
    detail: err?.response?.data?.message ?? err?.message ?? (typeof error === "string" ? error : undefined),
  };
}

async function classifyCartError(cartId: string, error: unknown): Promise<CartAddError> {
  const { status, type, code, detail } = readCartError(error);
  const backend = { status, type, code };
  if (!status || status >= 500 || status === 408 || status === 429) {
    return { ...backend, kind: "transport" };
  }
  if (/inventory|stock|insufficient|not enough/i.test([type, code, detail].join(" "))) {
    return { ...backend, kind: "inventory" };
  }

  // SDK FetchError drops the response's type/code. A 404 may refer to a
  // variant, and a 400 may mean validation OR a completed cart. Confirm the
  // cart's state rather than using status/message alone as a reset signal.
  if (status === 400 || status === 404 || status === 409) {
    try {
      const { cart } = await sdk.store.cart.retrieve(cartId, { fields: "id,completed_at" });
      // The backend can return this explicitly requested field even though
      // the SDK's StoreCart type omits it. Narrow the response without a cast.
      if (cart && "completed_at" in cart && cart.completed_at) {
        return { ...backend, kind: "cart_completed" };
      }
    } catch (verificationError) {
      if (readCartError(verificationError).status === 404) {
        return { ...backend, kind: "cart_not_found" };
      }
      // A failed state check is not proof of a stale cart.
    }
  }
  return { ...backend, kind: status === 400 || status === 422 ? "validation" : "unknown" };
}

export type BundleLineInput = {
  variant_id: string;
  quantity?: number;
  product_id?: string;
};

let cachedRegionId: string | null = null;

/** Get Europe region ID for cart creation (cached). */
export async function getDefaultRegionId(): Promise<string | null> {
  if (cachedRegionId) return cachedRegionId;
  try {
    const { regions } = await sdk.store.region.list({ limit: 50 });
    const europe = regions?.find((r: { id?: string; name?: string }) => r.name === "Europe");
    if (europe?.id) {
      cachedRegionId = europe.id;
      return europe.id;
    }
    return regions?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Create a new cart. */
export async function createCart(): Promise<{ cart_id: string } | null> {
  const regionId = await getDefaultRegionId();
  if (!regionId) return null;
  try {
    const { cart } = await sdk.store.cart.create(
      { region_id: regionId },
      { fields: "id" }
    );
    return cart?.id ? { cart_id: cart.id } : null;
  } catch {
    return null;
  }
}

/** Add a line item to a cart. */
export async function addToCart(
  cartId: string,
  variantId: string,
  quantity: number = 1,
  metadata?: CartLineMetadata
): Promise<CartAddResult> {
  try {
    const fields =
      "id,currency_code,*items,*items.variant,*items.variant.product";
    const payload: { variant_id: string; quantity: number; metadata?: CartLineMetadata } = {
      variant_id: variantId,
      quantity,
    };
    if (metadata) {
      payload.metadata = metadata;
    }
    await sdk.store.cart.createLineItem(
      cartId,
      payload,
      { fields }
    );
    return { success: true, cart_id: cartId };
  } catch (e) {
    const { detail, status } = readCartError(e);
    console.error(
      "Add to cart failed:",
      detail ?? e,
      status ? `(HTTP ${status})` : ""
    );
    return {
      success: false,
      message: mapAddToCartError(detail),
      error: await classifyCartError(cartId, e),
    };
  }
}

function mapAddToCartError(detail: string | null | undefined): string {
  const text = (detail ?? "").toLowerCase();
  if (
    text.includes("not associated with any stock location") ||
    text.includes("inventory item") ||
    text.includes("stock location")
  ) {
    return "Dit product heeft nog geen voorraad ingesteld. Probeer het later opnieuw.";
  }
  if (
    text.includes("insufficient") ||
    text.includes("not enough") ||
    text.includes("out of stock")
  ) {
    return "Dit product is tijdelijk niet op voorraad.";
  }
  return "Toevoegen mislukt";
}

/** Add multiple line items with shared bundle metadata. */
export async function addBundleToCart(
  cartId: string,
  bundleId: string,
  items: BundleLineInput[],
  options?: {
    bundleLabel?: string;
    bundleSource?: "project" | "workshop" | "event" | "manual";
  }
): Promise<{
  success: boolean;
  cart_id: string;
  added_count: number;
  failed_variant_ids: string[];
  failures: { variant_id: string; error: CartAddError }[];
}> {
  let addedCount = 0;
  const failedVariantIds: string[] = [];
  const failures: { variant_id: string; error: CartAddError }[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const line = items[i];
    const quantity = line.quantity && line.quantity > 0 ? line.quantity : 1;
    const metadata: CartLineMetadata = {
      bundle_id: bundleId,
      bundle_label: options?.bundleLabel ?? null,
      bundle_source: options?.bundleSource ?? "project",
      bundle_item_index: i + 1,
      bundle_product_id: line.product_id ?? null,
    };
    const result = await addToCart(
      cartId,
      line.variant_id,
      quantity,
      metadata
    );
    if (result.success) {
      addedCount += 1;
    } else {
      failedVariantIds.push(line.variant_id);
      failures.push({ variant_id: line.variant_id, error: result.error });
    }
  }

  return {
    success: failedVariantIds.length === 0,
    cart_id: cartId,
    added_count: addedCount,
    failed_variant_ids: failedVariantIds,
    failures,
  };
}

async function retrieveCartWithSellerItems(cartId: string) {
  const { cart } = await sdk.store.cart.retrieve(cartId, {
    fields: "id,completed_at,currency_code,*items,*items.variant,*items.variant.product,*items.variant.product.seller",
  });
  if (!cart) return null;
  const c = cart as { items?: unknown[]; line_items?: unknown[]; completed_at?: string | null };
  const items = c.items ?? c.line_items;
  if (c.completed_at) {
    return { ...cart, items: Array.isArray(items) ? items : [] };
  }
  // An omitted relation is not evidence that the cart is empty.
  if (!Array.isArray(items)) return null;
  return { ...cart, items };
}

/** Retrieve cart with items and totals. */
export async function getCart(cartId: string) {
  try {
    return await retrieveCartWithSellerItems(cartId);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getCart] failed:", e);
    }
    return null;
  }
}

/** Seller ids for display; validation must also reject every unresolved item. */
export function getCartSellerIds(cart: { items?: unknown[] } | null): string[] {
  if (!cart || !Array.isArray(cart.items)) return [];
  return [...new Set(cart.items.map(getCartItemSellerId).filter((id): id is string => id !== null))];
}

const SELLER_LOOKUP_PAGE_SIZE = 100;
const SELLER_LOOKUP_MAX_PAGES = 20;

/**
 * Medusa SDK 2.11.3 product.list supports fields/limit/offset, not a variant-id
 * filter (StoreProductListParams.variants only accepts options). Resolve the
 * whole batch in one bounded scan. Missing links, lookup errors and exhaustion
 * are all inconclusive, never permission to add. Product IDs from bundle
 * metadata are not evidence of a variant's product/seller association.
 */
async function getSellerIdsForVariants(
  variantIds: string[]
): Promise<Map<string, string> | null> {
  if (!variantIds.length || variantIds.some((id) => typeof id !== "string" || !id.trim())) {
    return null;
  }
  const requested = new Set(variantIds);
  const resolved = new Map<string, string>();
  let offset = 0;
  try {
    for (let page = 0; page < SELLER_LOOKUP_MAX_PAGES; page += 1) {
      const { products, count } = await sdk.store.product.list({
        fields: "id,*variants,*seller",
        limit: SELLER_LOOKUP_PAGE_SIZE,
        offset,
      });
      if (!Array.isArray(products) || !products.length) return null;
      for (const product of products) {
        for (const variant of product.variants ?? []) {
          if (!requested.has(variant.id)) continue;
          const sellerId = getCartItemSellerId({ variant: { product } });
          if (!sellerId || (resolved.has(variant.id) && resolved.get(variant.id) !== sellerId)) {
            return null;
          }
          resolved.set(variant.id, sellerId);
        }
      }
      if (resolved.size === requested.size) return resolved;
      // Use the actual page length: servers can clamp the requested limit.
      offset += products.length;
      if (offset >= count) return null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Null means unresolved and must not be treated as permission to add. */
export async function getSellerIdForVariant(
  variantId: string
): Promise<string | null> {
  return (await getSellerIdsForVariants([variantId]))?.get(variantId) ?? null;
}

/**
 * Validate the proposed FINAL seller set before any add (including bundles).
 * A null cartId explicitly means a new cart, not a failed cart retrieval.
 * This preflight is not atomic: backend enforcement is still required.
 */
export async function assertSingleSellerCart(
  cartId: string | null,
  variantIds: string | string[]
): Promise<{ ok: true } | { ok: false; message: string; error?: CartAddError }> {
  const unknownSeller = {
    ok: false as const,
    message: "De verkoper van één of meer producten kon niet worden gecontroleerd. Probeer het later opnieuw.",
  };
  const mixedSellers = {
    ok: false as const,
    message: "Je kunt alleen producten van één verkoper tegelijk bestellen. Rond je bestelling eerst af of pas je winkelwagen aan.",
  };

  let cart;
  try {
    cart = cartId === null ? { items: [] } : await retrieveCartWithSellerItems(cartId);
  } catch (error) {
    // Only a confirmed missing cart may enter replacement recovery. Transport
    // errors and incomplete responses cannot be interpreted as an empty cart.
    return readCartError(error).status === 404
      ? { ...unknownSeller, error: { kind: "cart_not_found" } }
      : unknownSeller;
  }
  if (!cart) return unknownSeller;
  if ("completed_at" in cart && cart.completed_at) {
    return { ...unknownSeller, error: { kind: "cart_completed" } };
  }
  if (!Array.isArray(cart.items)) return unknownSeller;
  const sellers = new Set<string>();
  for (const item of cart.items) {
    const sellerId = getCartItemSellerId(item);
    if (!sellerId) return unknownSeller;
    sellers.add(sellerId);
  }
  if (sellers.size > 1) return mixedSellers;

  const nextSellers = await getSellerIdsForVariants(
    typeof variantIds === "string" ? [variantIds] : variantIds
  );
  if (!nextSellers) return unknownSeller;
  for (const sellerId of nextSellers.values()) sellers.add(sellerId);
  return sellers.size === 1 ? { ok: true } : mixedSellers;
}

/** Retrieve cart with checkout fields (region, shipping, payment). */
export async function getCartForCheckout(cartId: string) {
  try {
    const query = {
      fields:
        "id,currency_code,region_id,email,shipping_address.*,billing_address.*,subtotal,total,shipping_total,*items,*items.variant,*items.variant.product,*items.variant.product.seller,shipping_methods.*,payment_collection.*,payment_collection.payment_sessions.*,payment_collection.payment_sessions.data",
    };
    const { cart } = await sdk.store.cart.retrieve(cartId, query);
    if (!cart) return null;
    const c = cart as { items?: unknown[]; line_items?: unknown[] };
    const items = c.items ?? c.line_items;
    // An omitted relation is not evidence that the cart is empty.
    if (!Array.isArray(items)) return null;
    return { ...cart, items };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getCartForCheckout] failed:", e);
    }
    return null;
  }
}

/** Remove a line item from the cart. */
export async function removeFromCart(
  cartId: string,
  lineItemId: string
): Promise<{ success: boolean }> {
  try {
    const fields =
      "id,currency_code,*items,*items.variant,*items.variant.product";
    await sdk.store.cart.deleteLineItem(cartId, lineItemId, { fields });
    return { success: true };
  } catch (e) {
    console.error("Remove from cart failed:", e);
    return { success: false };
  }
}

/** Update quantity for a cart line item. */
export async function updateCartLineItemQuantity(
  cartId: string,
  lineItemId: string,
  quantity: number
): Promise<{ success: boolean }> {
  if (!Number.isFinite(quantity) || quantity < 1) {
    return { success: false };
  }

  try {
    const fields =
      "id,currency_code,*items,*items.variant,*items.variant.product";
    await sdk.store.cart.updateLineItem(
      cartId,
      lineItemId,
      { quantity: Math.floor(quantity) },
      { fields }
    );
    return { success: true };
  } catch (e) {
    console.error("Update cart line item failed:", e);
    return { success: false };
  }
}

/** Address shape for shipping/billing. */
export type CartAddress = {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  postal_code: string;
  province?: string;
  country_code: string;
  phone?: string;
};

/** Update cart with email and addresses. */
export async function updateCart(
  cartId: string,
  data: {
    email?: string;
    shipping_address?: CartAddress;
    billing_address?: CartAddress;
  }
): Promise<{ success: boolean }> {
  try {
    await sdk.store.cart.update(cartId, data, {
      fields:
        "id,email,shipping_address.*,billing_address.*,*items,*items.variant,*items.variant.product",
    });
    return { success: true };
  } catch (e) {
    console.error("Update cart failed:", e);
    return { success: false };
  }
}

/** Shipping option returned from API. */
export type ShippingOption = {
  id: string;
  name: string;
  price_type?: string;
  amount?: number;
  data?: Record<string, unknown>;
};

/** List shipping options for cart. */
export async function getShippingOptions(
  cartId: string
): Promise<ShippingOption[] | null> {
  try {
    const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
      cart_id: cartId,
    });
    return (shipping_options ?? []) as ShippingOption[];
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getShippingOptions] failed:", e);
    }
    return null;
  }
}

/** Add shipping method to cart. */
export async function addShippingMethod(
  cartId: string,
  optionId: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean }> {
  try {
    await sdk.store.cart.addShippingMethod(
      cartId,
      { option_id: optionId, data: data ?? {} },
      {
        fields:
          "id,*items,*items.variant,*items.variant.product,shipping_methods.*",
      }
    );
    return { success: true };
  } catch (e) {
    console.error("Add shipping method failed:", e);
    return { success: false };
  }
}

/** List payment providers for region. */
export async function getPaymentProviders(regionId: string) {
  try {
    const { payment_providers } = await sdk.store.payment.listPaymentProviders({
      region_id: regionId,
    });
    return payment_providers ?? [];
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getPaymentProviders] failed:", e);
    }
    return [];
  }
}

/** Explicit checkout request: fetch the secret and recover only confirmed-canceled payments. */
export async function getPaymentClientSecret(
  cartId: string
): Promise<{
  client_secret?: string;
  payment_succeeded?: boolean;
  error?: string;
}> {
  try {
    const baseUrl = getBackendUrl();
    const pk =
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
      process.env.MEDUSA_PUBLISHABLE_KEY ??
      "";
    const res = await fetch(
      `${baseUrl}/store/carts/${cartId}/payment-client-secret`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": pk,
        },
      }
    );
    const json = (await res.json()) as {
      client_secret?: string;
      payment_succeeded?: boolean;
      message?: string;
    };
    if (!res.ok) {
      return { error: json.message ?? "Failed to get client secret" };
    }
    return {
      client_secret: json.client_secret,
      payment_succeeded: Boolean(json.payment_succeeded),
    };
  } catch (e) {
    console.error("[getPaymentClientSecret]", e);
    return { error: "Network error" };
  }
}

/** Initiate payment session for cart (e.g. Stripe). */
export async function initiatePaymentSession(
  cart: { id: string; region_id: string },
  providerId: string,
  data?: Record<string, unknown>
) {
  try {
    const { payment_collection } = await sdk.store.payment.initiatePaymentSession(
      cart as Parameters<typeof sdk.store.payment.initiatePaymentSession>[0],
      { provider_id: providerId, data: data ?? {} },
      { fields: "id,payment_sessions.id,payment_sessions.data,payment_sessions.*" }
    );
    return { success: true, payment_collection };
  } catch (e) {
    console.error("Initiate payment session failed:", e);
    return { success: false };
  }
}

/** Complete cart and place order. Returns order_set for Mercur. */
export async function completeCart(cartId: string) {
  try {
    const result = await sdk.store.cart.complete(cartId, {
      fields:
        "id,orders.*,orders.items.*,orders.shipping_address.*,orders.billing_address.*",
    });
    if (result.type === "cart") {
      const err = (result as { error?: { message?: string } }).error;
      return {
        success: false,
        error: typeof err === "string" ? err : err?.message ?? "Bestelling kon niet worden afgerond",
      };
    }
    return {
      success: true,
      order_set: (result as { order_set?: unknown }).order_set ?? result,
    };
  } catch (e) {
    console.error("Complete cart failed:", e);
    return { success: false };
  }
}
