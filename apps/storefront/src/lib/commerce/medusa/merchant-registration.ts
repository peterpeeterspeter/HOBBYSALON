import "server-only";

type ProvisionMerchantInput = {
  displayName: string;
  businessName?: string | null;
  contactName?: string | null;
  email: string;
  phone?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

type ProvisionMerchantResult = {
  ok: boolean;
  sellerId: string | null;
  status: "created" | "existing" | "failed";
  error?: string;
};

function getAdminConfig() {
  const baseUrl =
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    "http://localhost:9000";
  const adminToken =
    process.env.MEDUSA_ADMIN_API_TOKEN ??
    process.env.MEDUSA_ADMIN_TOKEN ??
    process.env.MEDUSA_BACKEND_ADMIN_TOKEN;

  if (!adminToken) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    adminToken,
  };
}

export async function provisionMerchantSeller(
  input: ProvisionMerchantInput
): Promise<ProvisionMerchantResult> {
  const config = getAdminConfig();
  if (!config) {
    return {
      ok: false,
      sellerId: null,
      status: "failed",
      error: "Missing MEDUSA_ADMIN_API_TOKEN on storefront server.",
    };
  }

  const response = await fetch(
    `${config.baseUrl}/admin/platform/materials/merchants/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.adminToken}`,
        "x-medusa-access-token": config.adminToken,
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
      error: `Merchant provisioning failed (${response.status}): ${body || "unknown error"}`,
    };
  }

  const payload = (await response.json()) as {
    merchant?: { seller_id?: string; status?: "created" | "existing" };
  };

  return {
    ok: !!payload.merchant?.seller_id,
    sellerId: payload.merchant?.seller_id ?? null,
    status: payload.merchant?.status ?? "created",
  };
}
