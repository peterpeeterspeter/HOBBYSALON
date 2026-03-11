"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createCart,
  addToCart,
  removeFromCart,
  CART_COOKIE_NAME,
  CART_COOKIE_MAX_AGE,
} from "@/lib/commerce/medusa/cart";

export type AddToCartResult = {
  success: boolean;
  message?: string;
};

export async function addToCartAction(
  variantId: string,
  quantity: number = 1
): Promise<AddToCartResult> {
  if (!variantId) {
    return { success: false, message: "Variant ontbreekt" };
  }

  const cookieStore = await cookies();
  let cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!cartId) {
    const created = await createCart();
    if (!created?.cart_id) {
      return { success: false, message: "Winkelwagen kon niet worden aangemaakt" };
    }
    cartId = created.cart_id;
    cookieStore.set(CART_COOKIE_NAME, cartId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: CART_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  let result = await addToCart(cartId, variantId, quantity);
  if (!result.success) {
    // Retry with fresh cart if existing cart may be stale (deleted in Medusa)
    const created = await createCart();
    if (created?.cart_id) {
      cartId = created.cart_id;
      cookieStore.set(CART_COOKIE_NAME, cartId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: CART_COOKIE_MAX_AGE,
        path: "/",
      });
      result = await addToCart(cartId, variantId, quantity);
    }
  }
  if (!result.success) {
    return { success: false, message: "Toevoegen mislukt" };
  }

  revalidatePath("/cart");
  return { success: true };
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
