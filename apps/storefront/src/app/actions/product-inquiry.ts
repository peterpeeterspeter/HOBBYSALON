"use server";

import { createPlatformClient } from "@/lib/platform/client";

export type ProductInquiryResult = {
  success: boolean;
  message?: string;
};

export async function submitProductInquiry(
  productId: string,
  creatorId: string,
  formData: FormData
): Promise<ProductInquiryResult> {
  const fullName = formData.get("full_name")?.toString()?.trim();
  const email = formData.get("email")?.toString()?.trim();
  const message = formData.get("message")?.toString()?.trim() || null;

  if (!fullName) {
    return { success: false, message: "Naam is verplicht" };
  }
  if (!email) {
    return { success: false, message: "E-mailadres is verplicht" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Ongeldig e-mailadres" };
  }

  try {
    const supabase = createPlatformClient();
    const { error } = await supabase.from("product_inquiries").insert({
      product_id: productId,
      creator_id: creatorId,
      full_name: fullName,
      email,
      message,
      status: "new",
    });

    if (error) {
      console.error("Product inquiry insert failed:", error);
      return {
        success: false,
        message: "Aanvraag mislukt. Probeer het later opnieuw.",
      };
    }

    return { success: true };
  } catch (e) {
    console.error("Product inquiry error:", e);
    return {
      success: false,
      message: "Er is iets misgegaan. Probeer het later opnieuw.",
    };
  }
}
