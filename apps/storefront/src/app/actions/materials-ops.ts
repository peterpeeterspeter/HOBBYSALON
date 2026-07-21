"use server";

import { cookies } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { getMedusaAdminBackendConfig } from "@/lib/commerce/medusa/medusa-admin-auth";
import { isModerator } from "@/lib/platform/queries/community-showcase";

const DEFAULT_REDIRECT_PATH = "/dashboard/materials";
const DRY_RUN_COOKIE_PREFIX = "hs_materials_dry_run_";
const FEED_MAPPING_PRESETS: Record<string, Record<string, string>> = {
  custom_csv_basic: {
    sku: "sku",
    price_amount: "price",
    price_currency: "currency",
    stocked_quantity: "stock",
    incoming_quantity: "incoming",
    location_id: "location_id",
  },
  woocommerce: {
    sku: "sku",
    price_amount: "price",
    price_currency: "currency",
    stocked_quantity: "stock_quantity",
    incoming_quantity: "incoming_quantity",
    location_id: "location_id",
  },
  shopify: {
    sku: "sku",
    price_amount: "price",
    price_currency: "currency",
    stocked_quantity: "inventory_quantity",
    incoming_quantity: "incoming_quantity",
    location_id: "location_id",
  },
};

type DryRunSnapshot = {
  seller_id: string;
  file_name: string;
  total_count: number;
  valid_count: number;
  error_count: number;
  unmapped_count: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  preview: Array<{
    row: number;
    title: string;
    status: string;
    source_category?: string;
    domain_id?: string;
  }>;
  created_at: string;
};

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

async function requireMaterialsOpsAccess(path: string = DEFAULT_REDIRECT_PATH) {
  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (!(await isModerator(user.id))) {
    redirect("/dashboard/verkoper");
  }
  return user;
}

function buildMaterialsPath(sellerId: string, merchantQ?: string) {
  const query = new URLSearchParams();
  if (merchantQ?.trim()) {
    query.set("merchant_q", merchantQ.trim());
  }
  if (sellerId.trim()) {
    query.set("seller_id", sellerId.trim());
  }
  const serialized = query.toString();
  return serialized ? `${DEFAULT_REDIRECT_PATH}?${serialized}` : DEFAULT_REDIRECT_PATH;
}

function getDryRunCookieName(sellerId: string) {
  return `${DRY_RUN_COOKIE_PREFIX}${sellerId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function persistDryRunSnapshot(snapshot: DryRunSnapshot) {
  const cookieStore = await cookies();
  cookieStore.set(getDryRunCookieName(snapshot.seller_id), JSON.stringify(snapshot), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard/materials",
    maxAge: 60 * 30,
  });
}

async function clearDryRunSnapshot(sellerId: string) {
  const cookieStore = await cookies();
  cookieStore.set(getDryRunCookieName(sellerId), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard/materials",
    maxAge: 0,
  });
}

function parseJsonObjectInput(raw: string, fieldName: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : `Invalid ${fieldName} JSON`
    );
  }
}

function resolveMappingFromForm(formData: FormData) {
  const mappingPreset = formData.get("mapping_preset")?.toString().trim() || "";
  const hasMappingJson = formData.has("mapping_json");
  const mappingJson = formData.get("mapping_json")?.toString() || "";

  if (hasMappingJson && mappingJson.trim()) {
    return parseJsonObjectInput(mappingJson, "mapping_json");
  }

  if (mappingPreset && mappingPreset !== "none") {
    return FEED_MAPPING_PRESETS[mappingPreset] || {};
  }

  return hasMappingJson ? {} : undefined;
}

export async function triggerMaterialsProjectionSyncAction(
  formData: FormData
): Promise<void> {
  const sellerId = formData.get("seller_id")?.toString().trim() || "";
  const merchantQ = formData.get("merchant_q")?.toString().trim() || "";
  const path = buildMaterialsPath(sellerId, merchantQ);
  await requireMaterialsOpsAccess(path);

  try {
    const config = await getMedusaAdminBackendConfig();

    if (!config) {
      fail(
        path,
        "Missing Medusa admin credentials (MEDUSA_ADMIN_EMAIL/PASSWORD or MEDUSA_ADMIN_API_TOKEN) on storefront server."
      );
    }

    const { baseUrl, adminToken } = config;

    const limitRaw = formData.get("limit")?.toString().trim() || "";
    const parsedLimit = Number.parseInt(limitRaw, 10);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 500)
        : undefined;

    const payload: Record<string, unknown> = {};
    if (sellerId) payload.seller_id = sellerId;
    if (limit) payload.limit = limit;

    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/admin/platform/products/projection/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          "x-medusa-access-token": adminToken,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      fail(
        path,
        `Projection sync failed (${response.status}): ${body || "unknown error"}`
      );
    }

    const result = (await response.json()) as {
      count?: number;
      batches?: number;
    };

    ok(
      path,
      `Projection sync queued: ${result.count ?? 0} product(en), ${result.batches ?? 0} batch(es).`
    );
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(
      path,
      error instanceof Error ? error.message : "Unknown projection sync error."
    );
  }
}

export async function createMerchantCategoryMappingAction(
  formData: FormData
): Promise<void> {
  const sellerId = formData.get("seller_id")?.toString().trim() || "";
  const merchantQ = formData.get("merchant_q")?.toString().trim() || "";
  const path = buildMaterialsPath(sellerId, merchantQ);
  await requireMaterialsOpsAccess(path);

  try {
    const config = await getMedusaAdminBackendConfig();

    if (!config) {
      fail(
        path,
        "Missing Medusa admin credentials (MEDUSA_ADMIN_EMAIL/PASSWORD or MEDUSA_ADMIN_API_TOKEN) on storefront server."
      );
    }

    const { baseUrl, adminToken } = config;

    if (!sellerId) {
      fail(path, "seller_id is required.");
    }

    const sourceCategory = formData.get("source_category")?.toString().trim() || "";
    const domainId = formData.get("domain_id")?.toString().trim() || "";
    const confidenceRaw = formData.get("confidence")?.toString().trim() || "";

    if (!sourceCategory) {
      fail(path, "source_category is required.");
    }
    if (!domainId) {
      fail(path, "domain_id is required.");
    }

    const confidenceParsed = confidenceRaw
      ? Number.parseFloat(confidenceRaw)
      : undefined;

    const payload: Record<string, unknown> = {
      source_category: sourceCategory,
      domain_id: domainId,
      active: true,
    };

    if (confidenceParsed !== undefined && Number.isFinite(confidenceParsed)) {
      payload.confidence = confidenceParsed;
    }

    const response = await fetch(
      `${baseUrl.replace(
        /\/$/,
        ""
      )}/admin/platform/materials/merchants/${encodeURIComponent(
        sellerId
      )}/category-mappings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          "x-medusa-access-token": adminToken,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      fail(
        path,
        `Create mapping failed (${response.status}): ${body || "unknown error"}`
      );
    }

    ok(path, "Category mapping created.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(path, error instanceof Error ? error.message : "Unknown mapping error.");
  }
}

export async function createMerchantFeedSourceAction(
  formData: FormData
): Promise<void> {
  const sellerId = formData.get("seller_id")?.toString().trim() || "";
  const merchantQ = formData.get("merchant_q")?.toString().trim() || "";
  const path = buildMaterialsPath(sellerId, merchantQ);
  await requireMaterialsOpsAccess(path);

  try {
    const config = await getMedusaAdminBackendConfig();
    if (!config) {
      fail(
        path,
        "Missing Medusa admin credentials (MEDUSA_ADMIN_EMAIL/PASSWORD or MEDUSA_ADMIN_API_TOKEN) on storefront server."
      );
    }
    const { baseUrl, adminToken } = config;
    if (!sellerId) {
      fail(path, "seller_id is required.");
    }

    const headersJson = formData.get("headers_json")?.toString() || "";
    const resolvedMapping = resolveMappingFromForm(formData);

    const payload: Record<string, unknown> = {
      name: formData.get("name")?.toString().trim() || "",
      provider: formData.get("provider")?.toString().trim() || "custom_csv",
      url: formData.get("url")?.toString().trim() || "",
      method: formData.get("method")?.toString().trim() || "GET",
      default_currency: formData.get("default_currency")?.toString().trim().toLowerCase() || undefined,
      default_location_id: formData.get("default_location_id")?.toString().trim() || undefined,
      auto_pull_enabled: Boolean(formData.get("auto_pull_enabled")),
      pull_interval_minutes: Number.parseInt(
        formData.get("pull_interval_minutes")?.toString().trim() || "60",
        10
      ),
      active: true,
      headers: parseJsonObjectInput(headersJson, "headers_json"),
      mapping: resolvedMapping ?? {},
    };

    const response = await fetch(
      `${baseUrl}/admin/platform/materials/merchants/${encodeURIComponent(
        sellerId
      )}/feed-sources`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          "x-medusa-access-token": adminToken,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      fail(
        path,
        `Create feed source failed (${response.status}): ${body || "unknown error"}`
      );
    }

    ok(path, "Feed source created.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(path, error instanceof Error ? error.message : "Unknown feed source error.");
  }
}

export async function updateMerchantFeedSourceAction(
  formData: FormData
): Promise<void> {
  const sellerId = formData.get("seller_id")?.toString().trim() || "";
  const feedId = formData.get("feed_id")?.toString().trim() || "";
  const merchantQ = formData.get("merchant_q")?.toString().trim() || "";
  const path = buildMaterialsPath(sellerId, merchantQ);
  await requireMaterialsOpsAccess(path);

  try {
    const config = await getMedusaAdminBackendConfig();
    if (!config) {
      fail(
        path,
        "Missing Medusa admin credentials (MEDUSA_ADMIN_EMAIL/PASSWORD or MEDUSA_ADMIN_API_TOKEN) on storefront server."
      );
    }
    const { baseUrl, adminToken } = config;
    if (!sellerId || !feedId) {
      fail(path, "seller_id and feed_id are required.");
    }

    const hasHeadersJson = formData.has("headers_json");
    const hasMappingJson = formData.has("mapping_json");
    const mappingPreset = formData.get("mapping_preset")?.toString().trim() || "";
    const headersJson = formData.get("headers_json")?.toString() || "";

    const payload: Record<string, unknown> = {
      name: formData.get("name")?.toString().trim() || undefined,
      provider: formData.get("provider")?.toString().trim() || undefined,
      url: formData.get("url")?.toString().trim() || undefined,
      method: formData.get("method")?.toString().trim() || undefined,
      default_currency:
        formData.get("default_currency")?.toString().trim().toLowerCase() || null,
      default_location_id:
        formData.get("default_location_id")?.toString().trim() || null,
      active: Boolean(formData.get("active")),
      auto_pull_enabled: Boolean(formData.get("auto_pull_enabled")),
    };

    if (hasHeadersJson) {
      payload.headers = parseJsonObjectInput(headersJson, "headers_json");
    }
    if (hasMappingJson || (mappingPreset && mappingPreset !== "none")) {
      payload.mapping = resolveMappingFromForm(formData) ?? {};
    }

    const intervalRaw = formData.get("pull_interval_minutes")?.toString().trim() || "";
    if (intervalRaw) {
      const intervalParsed = Number.parseInt(intervalRaw, 10);
      if (Number.isFinite(intervalParsed)) {
        payload.pull_interval_minutes = intervalParsed;
      }
    }

    const response = await fetch(
      `${baseUrl}/admin/platform/materials/merchants/${encodeURIComponent(
        sellerId
      )}/feed-sources/${encodeURIComponent(feedId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          "x-medusa-access-token": adminToken,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      fail(
        path,
        `Update feed source failed (${response.status}): ${body || "unknown error"}`
      );
    }

    ok(path, "Feed source updated.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(path, error instanceof Error ? error.message : "Unknown feed source update error.");
  }
}

export async function updateMaterialsRuleAction(formData: FormData): Promise<void> {
  const sellerId = formData.get("seller_id")?.toString().trim() || "";
  const merchantQ = formData.get("merchant_q")?.toString().trim() || "";
  const path = buildMaterialsPath(sellerId, merchantQ);
  await requireMaterialsOpsAccess(path);

  try {
    const config = await getMedusaAdminBackendConfig();
    if (!config) {
      fail(
        path,
        "Missing Medusa admin credentials (MEDUSA_ADMIN_EMAIL/PASSWORD or MEDUSA_ADMIN_API_TOKEN) on storefront server."
      );
    }
    const { baseUrl, adminToken } = config;

    const ruleId = formData.get("rule_id")?.toString().trim() || "";
    if (!ruleId) {
      fail(path, "rule_id is required.");
    }

    const enabled = Boolean(formData.get("is_enabled"));
    const response = await fetch(
      `${baseUrl}/admin/configuration/${encodeURIComponent(ruleId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          "x-medusa-access-token": adminToken,
        },
        body: JSON.stringify({ is_enabled: enabled }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      fail(path, `Rule update failed (${response.status}): ${body || "unknown error"}`);
    }

    ok(path, "Rule updated.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(path, error instanceof Error ? error.message : "Unknown rule update error.");
  }
}

export async function runMerchantFeedPullAction(formData: FormData): Promise<void> {
  const sellerId = formData.get("seller_id")?.toString().trim() || "";
  const feedId = formData.get("feed_id")?.toString().trim() || "";
  const merchantQ = formData.get("merchant_q")?.toString().trim() || "";
  const path = buildMaterialsPath(sellerId, merchantQ);
  await requireMaterialsOpsAccess(path);

  try {
    const config = await getMedusaAdminBackendConfig();
    if (!config) {
      fail(
        path,
        "Missing Medusa admin credentials (MEDUSA_ADMIN_EMAIL/PASSWORD or MEDUSA_ADMIN_API_TOKEN) on storefront server."
      );
    }
    const { baseUrl, adminToken } = config;
    if (!sellerId || !feedId) {
      fail(path, "seller_id and feed_id are required.");
    }

    const response = await fetch(
      `${baseUrl}/admin/platform/materials/merchants/${encodeURIComponent(
        sellerId
      )}/feed-sources/${encodeURIComponent(feedId)}/pull`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          "x-medusa-access-token": adminToken,
        },
        body: JSON.stringify({
          limit: 500,
          retries: 2,
          timeout_ms: 20000,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      fail(path, `Feed pull failed (${response.status}): ${body || "unknown error"}`);
    }

    ok(path, "Feed pull queued.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(path, error instanceof Error ? error.message : "Unknown feed pull error.");
  }
}

export async function runMerchantImportDryRunAction(
  formData: FormData
): Promise<void> {
  const sellerId = formData.get("seller_id")?.toString().trim() || "";
  const merchantQ = formData.get("merchant_q")?.toString().trim() || "";
  const path = buildMaterialsPath(sellerId, merchantQ);
  await requireMaterialsOpsAccess(path);

  try {
    const config = await getMedusaAdminBackendConfig();
    if (!config) {
      fail(
        path,
        "Missing Medusa admin credentials (MEDUSA_ADMIN_EMAIL/PASSWORD or MEDUSA_ADMIN_API_TOKEN) on storefront server."
      );
    }
    const { baseUrl, adminToken } = config;
    if (!sellerId) {
      fail(path, "seller_id is required.");
    }

    const file = formData.get("csv_file");
    if (!(file instanceof File)) {
      fail(path, "CSV file is required.");
    }

    const csvText = await file.text();
    if (!csvText.trim()) {
      fail(path, "CSV file is empty.");
    }

    const payload: Record<string, unknown> = {
      csv_text: csvText,
      delimiter: formData.get("delimiter")?.toString().trim() || undefined,
      currency_code: formData.get("currency_code")?.toString().trim().toLowerCase() || undefined,
    };

    const response = await fetch(
      `${baseUrl}/admin/platform/materials/merchants/${encodeURIComponent(
        sellerId
      )}/imports/dry-run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          "x-medusa-access-token": adminToken,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      fail(path, `Dry-run failed (${response.status}): ${body || "unknown error"}`);
    }

    const result = (await response.json()) as {
      dry_run?: {
        total_count: number;
        valid_count: number;
        error_count: number;
        unmapped_count: number;
        errors: Array<{ row: number; field?: string; message: string }>;
        preview: Array<{
          row: number;
          title: string;
          status: string;
          source_category?: string;
          domain_id?: string;
        }>;
      };
    };

    const dryRun = result.dry_run;
    if (!dryRun) {
      fail(path, "Dry-run returned no result.");
    }

    await persistDryRunSnapshot({
      seller_id: sellerId,
      file_name: file.name || "upload.csv",
      total_count: dryRun.total_count,
      valid_count: dryRun.valid_count,
      error_count: dryRun.error_count,
      unmapped_count: dryRun.unmapped_count,
      errors: dryRun.errors.slice(0, 8),
      preview: dryRun.preview.slice(0, 8),
      created_at: new Date().toISOString(),
    });

    ok(
      path,
      `Dry-run klaar: ${dryRun.total_count} rows, ${dryRun.valid_count} valid, ${dryRun.error_count} errors, ${dryRun.unmapped_count} unmapped.`
    );
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(path, error instanceof Error ? error.message : "Unknown dry-run error.");
  }
}

export async function submitMerchantImportAction(
  formData: FormData
): Promise<void> {
  const sellerId = formData.get("seller_id")?.toString().trim() || "";
  const merchantQ = formData.get("merchant_q")?.toString().trim() || "";
  const path = buildMaterialsPath(sellerId, merchantQ);
  await requireMaterialsOpsAccess(path);

  try {
    const config = await getMedusaAdminBackendConfig();
    if (!config) {
      fail(
        path,
        "Missing Medusa admin credentials (MEDUSA_ADMIN_EMAIL/PASSWORD or MEDUSA_ADMIN_API_TOKEN) on storefront server."
      );
    }
    const { baseUrl, adminToken } = config;
    if (!sellerId) {
      fail(path, "seller_id is required.");
    }

    const file = formData.get("csv_file");
    if (!(file instanceof File)) {
      fail(path, "CSV file is required.");
    }

    const csvText = await file.text();
    if (!csvText.trim()) {
      fail(path, "CSV file is empty.");
    }

    const response = await fetch(
      `${baseUrl}/admin/platform/materials/merchants/${encodeURIComponent(
        sellerId
      )}/imports`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          "x-medusa-access-token": adminToken,
        },
        body: JSON.stringify({
          csv_text: csvText,
          file_name: file.name || "upload.csv",
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      fail(path, `Import submit failed (${response.status}): ${body || "unknown error"}`);
    }

    await clearDryRunSnapshot(sellerId);

    const result = (await response.json()) as { job?: { id?: string } };
    ok(path, `Import queued. Job: ${result.job?.id || "n/a"}.`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(path, error instanceof Error ? error.message : "Unknown import submit error.");
  }
}
