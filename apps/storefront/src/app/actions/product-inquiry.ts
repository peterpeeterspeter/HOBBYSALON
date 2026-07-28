"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { sendProductInquiryCreatorEmail } from "@/lib/platform/notifications/product-inquiry-email";
import { resolveCreatorNotifyEmail } from "@/lib/platform/queries/product-inquiries";

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
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, title, slug, creator_id")
      .eq("id", productId)
      .eq("creator_id", creatorId)
      .maybeSingle();

    if (productError || !product) {
      return { success: false, message: "Plaatsing niet gevonden." };
    }

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

    const { data: creator } = await supabase
      .from("creators")
      .select("display_name, email, user_id")
      .eq("id", creatorId)
      .maybeSingle();

    const creatorEmail = await resolveCreatorNotifyEmail({
      creatorId,
      userId: creator?.user_id ?? null,
      profileEmail: creator?.email ?? null,
    });

    if (creatorEmail) {
      void sendProductInquiryCreatorEmail({
        creatorEmail,
        creatorName: creator?.display_name ?? "maker",
        productTitle: product.title,
        productSlug: product.slug,
        inquirerName: fullName,
        inquirerEmail: email,
        message,
      }).catch((err) => {
        console.error("Product inquiry email failed:", err);
      });
    } else {
      console.warn("Product inquiry created but no creator email to notify", {
        creatorId,
        productId,
      });
    }

    revalidatePath("/dashboard/products");
    return { success: true };
  } catch (e) {
    console.error("Product inquiry error:", e);
    return {
      success: false,
      message: "Er is iets misgegaan. Probeer het later opnieuw.",
    };
  }
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

export async function updateProductInquiryStatusAction(
  formData: FormData
): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    fail("/login?next=/dashboard/products", "Meld je eerst aan.");
  }

  const creator = await getCreatorByUserId(user.id);
  if (!creator) {
    fail("/dashboard/products", "Geen creator-profiel.");
  }

  const inquiryId = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = new Set(["new", "contacted", "accepted", "declined"]);
  if (!/^[0-9a-f-]{36}$/i.test(inquiryId) || !allowed.has(status)) {
    fail("/dashboard/products", "Ongeldige aanvraagstatus.");
  }

  const supabase = createPlatformClient();
  const { error } = await supabase
    .from("product_inquiries")
    .update({ status })
    .eq("id", inquiryId)
    .eq("creator_id", creator.id);

  if (error) {
    fail("/dashboard/products", "Status bijwerken mislukt.");
  }

  ok("/dashboard/products", "Aanvraagstatus bijgewerkt.");
}
