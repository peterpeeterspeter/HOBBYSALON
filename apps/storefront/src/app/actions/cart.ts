"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createCart,
  addToCart,
  addBundleToCart,
  isStaleCartError,
  type BundleLineInput,
  removeFromCart,
  updateCartLineItemQuantity,
  assertSingleSellerCart,
  CART_COOKIE_NAME,
  CART_COOKIE_MAX_AGE,
} from "@/lib/commerce/medusa/cart";

export type AddToCartResult = {
  success: boolean;
  message?: string;
  added_count?: number;
  failed_count?: number;
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function setCartCookie(cookieStore: CookieStore, cartId: string): void {
  cookieStore.set(CART_COOKIE_NAME, cartId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CART_COOKIE_MAX_AGE,
    path: "/",
  });
}

async function getOrCreateCartId(
  cookieStore: CookieStore,
  variantIds: string | string[]
): Promise<{ ok: true; cartId: string } | { ok: false; message: string }> {
  let existing = cookieStore.get(CART_COOKIE_NAME)?.value;
  let check = await assertSingleSellerCart(existing ?? null, variantIds);
  if (!check.ok && check.error && isStaleCartError(check.error)) {
    // A confirmed missing or completed cart is replaced only after the proposed
    // batch validates as its own single-seller cart. The cookie stays on the
    // old id until an add to the replacement actually succeeds.
    existing = undefined;
    check = await assertSingleSellerCart(null, variantIds);
  }
  if (!check.ok) return { ok: false, message: check.message };
  if (existing) return { ok: true, cartId: existing };

  const created = await createCart();
  if (!created?.cart_id) {
    return { ok: false, message: "Winkelwagen kon niet worden aangemaakt" };
  }
  // Keep an old cookie until a replacement actually contains added items.
  return { ok: true, cartId: created.cart_id };
}

export async function addToCartAction(
  variantId: string,
  quantity: number = 1
): Promise<AddToCartResult> {
  if (!variantId) {
    return { success: false, message: "Variant ontbreekt" };
  }

  const cookieStore = await cookies();
  const prepared = await getOrCreateCartId(cookieStore, variantId);
  if (!prepared.ok) return { success: false, message: prepared.message };
  let cartId = prepared.cartId;

  let result = await addToCart(cartId, variantId, quantity);
  if (!result.success && isStaleCartError(result.error)) {
    const check = await assertSingleSellerCart(null, variantId);
    if (!check.ok) return { success: false, message: check.message };
    // Keep the old cookie until an add to the replacement succeeds.
    const created = await createCart();
    if (created?.cart_id) {
      result = await addToCart(created.cart_id, variantId, quantity);
      if (result.success) cartId = created.cart_id;
    }
  }
  if (!result.success) {
    return {
      success: false,
      message: result.message ?? "Toevoegen mislukt",
    };
  }

  if (cookieStore.get(CART_COOKIE_NAME)?.value !== cartId) {
    setCartCookie(cookieStore, cartId);
  }
  revalidatePath("/cart");
  return { success: true };
}

type BundleAddItemInput = {
  variant_id: string;
  quantity?: number;
  product_id?: string;
};

export async function addBundleToCartAction(
  bundleId: string,
  items: BundleAddItemInput[],
  bundleLabel?: string
): Promise<AddToCartResult> {
  if (!bundleId || !items.length) {
    return { success: false, message: "Bundel is leeg" };
  }

  if (items.some((item) => typeof item.variant_id !== "string" || !item.variant_id.trim())) {
    return { success: false, message: "Eén of meer bundelitems hebben geen geldige variant" };
  }

  const validItems: BundleLineInput[] = items.map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
    product_id: item.product_id,
  }));

  const cookieStore = await cookies();
  const variantIds = validItems.map((item) => item.variant_id);
  const prepared = await getOrCreateCartId(cookieStore, variantIds);
  if (!prepared.ok) return { success: false, message: prepared.message };
  let cartId = prepared.cartId;

  let result = await addBundleToCart(cartId, bundleId, validItems, {
    bundleLabel,
    bundleSource: "project",
  });

  if (
    !result.success && result.added_count === 0 &&
    result.failures.length > 0 &&
    result.failures.every(({ error }) => isStaleCartError(error))
  ) {
    const check = await assertSingleSellerCart(null, variantIds);
    if (!check.ok) return { success: false, message: check.message };
    const created = await createCart();
    if (created?.cart_id) {
      result = await addBundleToCart(created.cart_id, bundleId, validItems, {
        bundleLabel,
        bundleSource: "project",
      });
      // Partial progress is usable: retain access to successful bundle lines.
      if (result.added_count > 0) cartId = created.cart_id;
    }
  }

  if (result.added_count > 0 && cookieStore.get(CART_COOKIE_NAME)?.value !== cartId) {
    setCartCookie(cookieStore, cartId);
  }
  revalidatePath("/cart");

  if (result.added_count === 0) {
    return { success: false, message: "Bundel toevoegen mislukt", added_count: 0 };
  }

  if (!result.success) {
    return {
      success: false,
      message: "Een deel van de bundel kon niet worden toegevoegd",
      added_count: result.added_count,
      failed_count: result.failed_variant_ids.length,
    };
  }

  return {
    success: true,
    added_count: result.added_count,
    failed_count: 0,
  };
}

export async function removeFromCartAction(
  lineItemId: string
): Promise<AddToCartResult> {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!cartId) {
    return { success: false, message: "Winkelwagen niet gevonden" };
  }

  const result = await removeFromCart(cartId, lineItemId);
  if (!result.success) {
    return { success: false, message: "Verwijderen mislukt" };
  }

  revalidatePath("/cart");
  return { success: true };
}

export async function updateCartLineItemQuantityAction(
  lineItemId: string,
  quantity: number
): Promise<AddToCartResult> {
  if (!lineItemId) {
    return { success: false, message: "Product ontbreekt" };
  }

  if (!Number.isFinite(quantity) || quantity < 1) {
    return { success: false, message: "Ongeldig aantal" };
  }

  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!cartId) {
    return { success: false, message: "Winkelwagen niet gevonden" };
  }

  const result = await updateCartLineItemQuantity(
    cartId,
    lineItemId,
    Math.floor(quantity)
  );
  if (!result.success) {
    return { success: false, message: "Aantal aanpassen mislukt" };
  }

  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { success: true };
}
