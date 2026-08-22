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
import { medusaAmountToCents } from "@/lib/commerce/money";

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
  payment_already_succeeded?: boolean;
  payment_already_completed?: boolean;
  orderSetId?: string;
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

  const existingPc = (
    cart as {
      payment_collection?: { payment_sessions?: unknown[] };
    }
  )?.payment_collection;
  const hasExistingSession = (existingPc?.payment_sessions?.length ?? 0) > 0;

  // If a session already exists, check Stripe first. A succeeded PaymentIntent
  // must complete the order — never create a replacement session.
  if (hasExistingSession) {
    const existingSecret = await getPaymentClientSecret(cartId);
    if (existingSecret.payment_succeeded) {
      const completed = await checkoutComplete({ redirect: false });
      if (completed.success) {
        return {
          success: true,
          clientSecret: existingSecret.client_secret,
          payment_already_completed: true,
          orderSetId: completed.orderSetId,
        };
      }
      return {
        success: false,
        payment_already_succeeded: true,
        message:
          completed.message ??
          "Betaling is ontvangen, maar de bestelling kon niet worden afgerond. Vernieuw de pagina of neem contact op.",
      };
    }
    if (existingSecret.client_secret) {
      return { success: true, clientSecret: existingSecret.client_secret };
    }
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
    // Initiate can fail when a succeeded PI cannot be replaced — check again.
    const secretResult = await getPaymentClientSecret(cartId);
    if (secretResult.payment_succeeded) {
      const completed = await checkoutComplete({ redirect: false });
      if (completed.success) {
        return {
          success: true,
          clientSecret: secretResult.client_secret,
          payment_already_completed: true,
          orderSetId: completed.orderSetId,
        };
      }
    }
    return {
      success: false,
      message: secretResult.error ?? "Betaling kon niet worden gestart",
    };
  }

  const secretResult = await getPaymentClientSecret(cartId);
  if (secretResult.payment_succeeded) {
    const completed = await checkoutComplete({ redirect: false });
    if (completed.success) {
      return {
        success: true,
        clientSecret: secretResult.client_secret,
        payment_already_completed: true,
        orderSetId: completed.orderSetId,
      };
    }
    return {
      success: false,
      payment_already_succeeded: true,
      message:
        completed.message ??
        "Betaling is ontvangen, maar de bestelling kon niet worden afgerond. Vernieuw de pagina of neem contact op.",
    };
  }

  if (!secretResult.client_secret) {
    return {
      success: false,
      message: secretResult.error ?? "Betaalsessie niet beschikbaar",
    };
  }

  return { success: true, clientSecret: secretResult.client_secret };
}

export type CheckoutCompleteResult = {
  success: boolean;
  orderSetId?: string;
  bundleCount?: number;
  bundleValue?: number;
  bundleId?: string;
  bundleIds?: string[];
  message?: string;
};

type CheckoutLineItem = {
  quantity?: number;
  total?: number;
  unit_price?: number;
  metadata?: Record<string, unknown>;
};

function getBundleContextFromCart(cart: unknown): {
  bundleIds: string[];
  bundleValue: number;
} {
  const items = ((cart as { items?: unknown[] })?.items ?? []) as CheckoutLineItem[];
  const bundleIds = new Set<string>();
  let bundleValue = 0;

  for (const item of items) {
    const bundleId =
      typeof item.metadata?.bundle_id === "string"
        ? item.metadata.bundle_id
        : null;
    if (!bundleId) continue;
    bundleIds.add(bundleId);
    const itemTotal =
      item.total ??
      ((item.unit_price ?? 0) * (item.quantity && item.quantity > 0 ? item.quantity : 1));
    bundleValue += medusaAmountToCents(itemTotal);
  }

  return {
    bundleIds: [...bundleIds],
    bundleValue,
  };
}

export async function checkoutComplete(options?: {
  redirect?: boolean;
}): Promise<CheckoutCompleteResult> {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (!cartId) {
    return { success: false, message: "Geen winkelwagen gevonden" };
  }

  const cartBeforeComplete = await getCartForCheckout(cartId);
  const bundleContext = getBundleContextFromCart(cartBeforeComplete);

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
  if (shouldRedirect) {
    const successParams = new URLSearchParams();
    if (orderSetId) {
      successParams.set("order", orderSetId);
    }
    if (bundleContext.bundleIds.length > 0) {
      const primaryBundleId = bundleContext.bundleIds[0];
      if (primaryBundleId) {
        successParams.set("bundle_id", primaryBundleId);
      }
      successParams.set("bundle_count", String(bundleContext.bundleIds.length));
      successParams.set("bundle_value", String(bundleContext.bundleValue));
      successParams.set("bundle_ids", bundleContext.bundleIds.join(","));
    }
    const query = successParams.toString();
    redirect(query ? `/checkout/success?${query}` : "/checkout/success");
  }

  return {
    success: true,
    orderSetId,
    bundleCount: bundleContext.bundleIds.length,
    bundleValue: bundleContext.bundleValue,
    bundleId: bundleContext.bundleIds[0] ?? undefined,
    bundleIds: bundleContext.bundleIds,
  };
}
