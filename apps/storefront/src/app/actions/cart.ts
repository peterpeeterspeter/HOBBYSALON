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
  cookieStore: CookieStore
): Promise<string | null> {
  const existing = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (existing) return existing;

  const created = await createCart();
  if (!created?.cart_id) return null;

  setCartCookie(cookieStore, created.cart_id);
  return created.cart_id;
}

export async function addToCartAction(
  variantId: string,
  quantity: number = 1
): Promise<AddToCartResult> {
  if (!variantId) {
    return { success: false, message: "Variant ontbreekt" };
  }

  const cookieStore = await cookies();
  const cartId = await getOrCreateCartId(cookieStore);
  if (!cartId) {
    return { success: false, message: "Winkelwagen kon niet worden aangemaakt" };
  }

  let result = await addToCart(cartId, variantId, quantity);
  if (!result.success && isStaleCartError(result.error)) {
    // Keep the old cookie until an add to the replacement succeeds.
    const created = await createCart();
    if (created?.cart_id) {
      result = await addToCart(created.cart_id, variantId, quantity);
      if (result.success) setCartCookie(cookieStore, created.cart_id);
    }
  }
  if (!result.success) {
    return {
      success: false,
      message: result.message ?? "Toevoegen mislukt",
    };
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

  const validItems: BundleLineInput[] = items
    .filter((item) => !!item.variant_id)
    .map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
      product_id: item.product_id,
    }));

  if (!validItems.length) {
    return { success: false, message: "Geen geldige bundelitems geselecteerd" };
  }

  const cookieStore = await cookies();
  const cartId = await getOrCreateCartId(cookieStore);
  if (!cartId) {
    return { success: false, message: "Winkelwagen kon niet worden aangemaakt" };
  }

  let result = await addBundleToCart(cartId, bundleId, validItems, {
    bundleLabel,
    bundleSource: "project",
  });

  if (
    !result.success && result.added_count === 0 &&
    result.failures.length > 0 &&
    result.failures.every(({ error }) => isStaleCartError(error))
  ) {
    const created = await createCart();
    if (created?.cart_id) {
      result = await addBundleToCart(created.cart_id, bundleId, validItems, {
        bundleLabel,
        bundleSource: "project",
      });
      // Partial progress is usable: retain access to successful bundle lines.
      if (result.added_count > 0) setCartCookie(cookieStore, created.cart_id);
    }
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
