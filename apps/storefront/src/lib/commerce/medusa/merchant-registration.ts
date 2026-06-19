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

type ProvisionMerchantOptions = {
  supabaseAccessToken?: string | null;
};

type ProvisionMerchantResult = {
  ok: boolean;
  sellerId: string | null;
  status: "created" | "existing" | "failed";
  error?: string;
};

function getBackendUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    "http://localhost:9000"
  ).replace(/\/$/, "");
}

function getPublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
    process.env.MEDUSA_PUBLISHABLE_KEY ??
    ""
  );
}

function getAdminConfig() {
  const adminToken =
    process.env.MEDUSA_ADMIN_API_TOKEN ??
    process.env.MEDUSA_ADMIN_TOKEN ??
    process.env.MEDUSA_BACKEND_ADMIN_TOKEN;

  if (!adminToken) {
    return null;
  }

  return {
    baseUrl: getBackendUrl(),
    adminToken,
  };
}

async function provisionMerchantViaStore(
  input: ProvisionMerchantInput,
  supabaseAccessToken: string
): Promise<ProvisionMerchantResult> {
  const publishableKey = getPublishableKey();
  const response = await fetch(
    `${getBackendUrl()}/store/platform/merchants/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAccessToken}`,
        ...(publishableKey
          ? { "x-publishable-api-key": publishableKey }
          : {}),
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
      error: `Merchant store provisioning failed (${response.status}): ${body || "unknown error"}`,
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

async function provisionMerchantViaAdmin(
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

export async function provisionMerchantSeller(
  input: ProvisionMerchantInput,
  options?: ProvisionMerchantOptions
): Promise<ProvisionMerchantResult> {
  const supabaseAccessToken = options?.supabaseAccessToken?.trim();
  if (supabaseAccessToken) {
    return provisionMerchantViaStore(input, supabaseAccessToken);
  }

  return provisionMerchantViaAdmin(input);
}

export function formatMerchantProvisionError(error?: string): string {
  if (!error) {
    return "Merchant-profiel aanmaken mislukt.";
  }

  const normalized = error.toLowerCase();

  if (normalized.includes("missing medusa_admin_api_token")) {
    return "Merchant-registratie is tijdelijk niet beschikbaar. Probeer later opnieuw.";
  }

  if (
    normalized.includes("(401)") ||
    normalized.includes("(403)")
  ) {
    return "Je sessie is verlopen. Meld je opnieuw aan.";
  }

  if (normalized.includes("(404)")) {
    return "Merchant-registratie is tijdelijk niet beschikbaar. Probeer later opnieuw.";
  }

  if (
    normalized.includes("already exists as creator") ||
    normalized.includes("already exists as") ||
    normalized.includes("(409)")
  ) {
    return "Dit e-mailadres is al gekoppeld aan een ander accounttype. Gebruik een nieuw e-mailadres voor je winkel.";
  }

  if (normalized.includes("invalid email") || normalized.includes("invalid_format")) {
    return "Controleer je e-mailadres en probeer opnieuw.";
  }

  return "Merchant-profiel aanmaken mislukt. Probeer opnieuw of gebruik een ander e-mailadres.";
}
