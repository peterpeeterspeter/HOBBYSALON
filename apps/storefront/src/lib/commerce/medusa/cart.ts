import { sdk } from "./client";

const getBackendUrl = () =>
  process.env.MEDUSA_BACKEND_URL ??
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  "http://localhost:9000";

const CART_COOKIE_NAME = "medusa_cart_id";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export { CART_COOKIE_NAME, CART_COOKIE_MAX_AGE };

type CartLineMetadata = Record<string, unknown>;

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
): Promise<{ success: boolean; cart_id?: string; message?: string }> {
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
    const err = e as {
      message?: string;
      response?: { status?: number; data?: { message?: string } };
    };
    const detail =
      err?.response?.data?.message ??
      err?.message ??
      (typeof e === "string" ? e : null);
    console.error(
      "Add to cart failed:",
      detail ?? err,
      err?.response?.status ? `(HTTP ${err.response.status})` : ""
    );
    return {
      success: false,
      message: mapAddToCartError(detail),
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
}> {
  let addedCount = 0;
  const failedVariantIds: string[] = [];

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
    }
  }

  return {
    success: failedVariantIds.length === 0,
    cart_id: cartId,
    added_count: addedCount,
    failed_variant_ids: failedVariantIds,
  };
}

/** Retrieve cart with items and totals. */
export async function getCart(cartId: string) {
  try {
    const query = {
      fields:
        "id,currency_code,*items,*items.variant,*items.variant.product",
    };
    const { cart } = await sdk.store.cart.retrieve(cartId, query);
    if (!cart) return null;
    // Mercur/Medusa cart uses items relation
    const c = cart as { items?: unknown[]; line_items?: unknown[] };
    const items = c.items ?? c.line_items ?? [];
    return { ...cart, items };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getCart] failed:", e);
    }
    return null;
  }
}

/** Retrieve cart with checkout fields (region, shipping, payment). */
export async function getCartForCheckout(cartId: string) {
  try {
    const query = {
      fields:
        "id,currency_code,region_id,email,shipping_address.*,billing_address.*,subtotal,total,shipping_total,*items,*items.variant,*items.variant.product,shipping_methods.*,payment_collection.*,payment_collection.payment_sessions.*,payment_collection.payment_sessions.data",
    };
    const { cart } = await sdk.store.cart.retrieve(cartId, query);
    if (!cart) return null;
    const c = cart as { items?: unknown[]; line_items?: unknown[] };
    const items = c.items ?? c.line_items ?? [];
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

/** Fetch Stripe client_secret from backend (auto-refreshes if PaymentIntent is terminal). */
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
        method: "GET",
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
