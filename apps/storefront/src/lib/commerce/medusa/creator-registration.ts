import "server-only";

import { resolveMedusaAdminToken } from "./medusa-admin-auth";

type ProvisionCreatorInput = {
  displayName: string;
  businessName?: string | null;
  contactName?: string | null;
  email: string;
  phone?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

type ProvisionCreatorResult = {
  ok: boolean;
  sellerId: string | null;
  status: "created" | "existing" | "failed";
  error?: string;
};

export async function provisionCreatorSeller(
  input: ProvisionCreatorInput
): Promise<ProvisionCreatorResult> {
  const baseUrl =
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    "http://localhost:9000";
  const adminToken = await resolveMedusaAdminToken();
  if (!adminToken) {
    return {
      ok: false,
      sellerId: null,
      status: "failed",
      error: "Missing MEDUSA_ADMIN_API_TOKEN on storefront server.",
    };
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/admin/platform/creators/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
        "x-medusa-access-token": adminToken,
      },
      body: JSON.stringify({
        name: input.businessName?.trim() || input.displayName.trim(),
        contact_name: input.contactName?.trim() || null,
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        city: input.city?.trim() || null,
        postal_code: input.postalCode?.trim() || null,
        country_code: input.countryCode?.trim() || "BE",
        description: null,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      sellerId: null,
      status: "failed",
      error: `Creator provisioning failed (${response.status}): ${body || "unknown error"}`,
    };
  }

  const payload = (await response.json()) as {
    creator?: { seller_id?: string; status?: "created" | "existing" };
  };

  return {
    ok: !!payload.creator?.seller_id,
    sellerId: payload.creator?.seller_id ?? null,
    status: payload.creator?.status ?? "created",
  };
}
