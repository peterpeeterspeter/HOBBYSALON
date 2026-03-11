"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CART_COOKIE_NAME,
  updateCart,
  addShippingMethod,
  initiatePaymentSession,
  getPaymentClientSecret,
  completeCart,
  getCartForCheckout,
  getPaymentProviders,
  type CartAddress,
} from "@/lib/commerce/medusa/cart";

export type CheckoutStep = "address" | "shipping" | "payment";

export type CheckoutUpdateAddressResult = {
  success: boolean;
  message?: string;
};

export async function checkoutUpdateAddress(
  _prev: CheckoutUpdateAddressResult,
  formData: FormData
): Promise<CheckoutUpdateAddressResult> {
  const cartId = (await cookies()).get(CART_COOKIE_NAME)?.value;
  if (!cartId) {
    return { success: false, message: "Geen winkelwagen gevonden" };
  }

  const email = formData.get("email")?.toString()?.trim();
  if (!email) {
    return { success: false, message: "E-mailadres is verplicht" };
  }

  const address: CartAddress = {
    first_name: formData.get("first_name")?.toString()?.trim() ?? "",
    last_name: formData.get("last_name")?.toString()?.trim() ?? "",
    address_1: formData.get("address_1")?.toString()?.trim() ?? "",
    address_2: formData.get("address_2")?.toString()?.trim() || undefined,
    city: formData.get("city")?.toString()?.trim() ?? "",
    postal_code: formData.get("postal_code")?.toString()?.trim() ?? "",
    province: formData.get("province")?.toString()?.trim() || undefined,
    country_code: formData.get("country_code")?.toString()?.trim() ?? "nl",
    phone: formData.get("phone")?.toString()?.trim() || undefined,
  };

  if (!address.first_name || !address.last_name || !address.address_1 || !address.city || !address.postal_code) {
    return { success: false, message: "Vul alle verplichte velden in" };
  }

  const result = await updateCart(cartId, {
    email,
    shipping_address: address,
    billing_address: address,
  });

  if (!result.success) {
    return { success: false, message: "Adres kon niet worden opgeslagen" };
  }

  revalidatePath("/checkout");
  return { success: true };
}

export type CheckoutSelectShippingResult = {
  success: boolean;
  message?: string;
};

export async function checkoutSelectShipping(
  optionId: string
): Promise<CheckoutSelectShippingResult> {
  const cartId = (await cookies()).get(CART_COOKIE_NAME)?.value;
  if (!cartId) {
    return { success: false, message: "Geen winkelwagen gevonden" };
  }

  const result = await addShippingMethod(cartId, optionId);
  if (!result.success) {
    return { success: false, message: "Verzendmethode kon niet worden toegevoegd" };
  }

  return { success: true };
}

export type CheckoutInitiatePaymentResult = {
  success: boolean;
  clientSecret?: string;
  message?: string;
};

export async function checkoutInitiatePayment(): Promise<CheckoutInitiatePaymentResult> {
  const cartId = (await cookies()).get(CART_COOKIE_NAME)?.value;
  if (!cartId) {
    return { success: false, message: "Geen winkelwagen gevonden" };
  }

  const cart = await getCartForCheckout(cartId);
  if (!cart) {
    return { success: false, message: "Winkelwagen niet gevonden" };
  }

  const regionId = (cart as { region_id?: string }).region_id;
  if (!regionId) {
    return { success: false, message: "Regio ontbreekt" };
  }

  const providers = await getPaymentProviders(regionId);
  const stripeProvider = providers.find(
    (p: { id?: string }) =>
      p.id?.includes("stripe") || p.id === "pp_stripe_stripe-connect"
  );
  const providerId = stripeProvider?.id ?? providers[0]?.id;

  if (!providerId) {
    return { success: false, message: "Geen betaalmethode beschikbaar" };
  }

  const result = await initiatePaymentSession(
    cart as { id: string; region_id: string },
    providerId
  );

  if (!result.success) {
    return { success: false, message: "Betaling kon niet worden gestart" };
  }

  // Prefer payment_collection from initiate response (may include full session data)
  const pc = (result as { payment_collection?: { payment_sessions?: unknown[] } })
    ?.payment_collection;
  let sessions = pc?.payment_sessions ?? [];

  // Fallback: refetch cart if initiate response has no usable session
  if (sessions.length === 0) {
    const updatedCart = await getCartForCheckout(cartId);
    const cartPc = (updatedCart as { payment_collection?: { payment_sessions?: unknown[] } })
      ?.payment_collection;
    sessions = cartPc?.payment_sessions ?? [];
  }

  // Always fetch client_secret from backend route (auto-refreshes if PaymentIntent is terminal)
  const { client_secret, error } = await getPaymentClientSecret(cartId);
  if (!client_secret) {
    return {
      success: false,
      message: error ?? "Betaalsessie niet beschikbaar",
    };
  }

  return { success: true, clientSecret: client_secret };
}

export type CheckoutCompleteResult = {
  success: boolean;
  orderSetId?: string;
  message?: string;
};

export async function checkoutComplete(options?: {
  redirect?: boolean;
}): Promise<CheckoutCompleteResult> {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (!cartId) {
    return { success: false, message: "Geen winkelwagen gevonden" };
  }

  const result = await completeCart(cartId);

  if (!result.success) {
    return {
      success: false,
      message: (result as { error?: string }).error ?? "Bestelling kon niet worden afgerond",
    };
  }

  const orderSet = (result as { order_set?: { id?: string } }).order_set;
  const orderSetId = orderSet?.id;

  cookieStore.delete(CART_COOKIE_NAME);

  const shouldRedirect = options?.redirect !== false;
  if (shouldRedirect && orderSetId) {
    redirect(`/checkout/success?order=${orderSetId}`);
  }
  if (shouldRedirect) {
    redirect("/checkout/success");
  }

  return { success: true, orderSetId };
}
