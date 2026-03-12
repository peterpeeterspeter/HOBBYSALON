import "server-only";

export type MerchantMaterialsOverview = {
  seller_id: string;
  seller_name: string | null;
  seller_handle: string | null;
  store_status: string | null;
  category_mapping_count: number;
  import_job_count: number;
  feed_source_count: number;
  sync_job_count: number;
  published_product_count: number;
};

type MerchantOverviewResponse = {
  merchants: MerchantMaterialsOverview[];
  count: number;
  offset: number;
  limit: number;
};

export type MerchantMaterialsDetail = {
  merchant: {
    seller_id: string;
    seller_name: string | null;
    seller_handle: string | null;
    store_status: string | null;
    counts: {
      category_mappings: number;
      import_jobs: number;
      feed_sources: number;
      sync_jobs: number;
      published_products: number;
    };
    latest: {
      category_mappings: Array<{
        id: string;
        source_category: string | null;
        product_category_id: string | null;
        active: boolean;
        updated_at: string;
      }>;
      import_jobs: Array<{
        id: string;
        status: string;
        total_count: number;
        created_at: string;
      }>;
      feed_sources: Array<{
        id: string;
        name: string | null;
        provider: string | null;
        url: string | null;
        method: string | null;
        default_currency: string | null;
        default_location_id: string | null;
        headers?: Record<string, unknown> | null;
        mapping?: Record<string, unknown> | null;
        active: boolean;
        auto_pull_enabled: boolean;
        pull_interval_minutes: number | null;
        updated_at: string;
      }>;
      sync_jobs: Array<{
        id: string;
        status: string;
        total_count: number;
        accepted_count: number;
        rejected_count: number;
        created_at: string;
      }>;
      products: Array<{
        id: string;
        title: string | null;
        handle: string | null;
        status: string;
        updated_at: string;
      }>;
    };
  };
};

export type MaterialCategoryOption = {
  id: string;
  name: string;
  handle: string;
};

export type FeedRun = {
  id: string;
  status: "processing" | "success" | "partial" | "failed";
  trigger_type: "manual" | "scheduled";
  total_count: number;
  accepted_count: number;
  rejected_count: number;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
};

export type FeedMetrics = {
  metrics: {
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    processing_runs: number;
    success_rate: number;
    avg_duration_ms: number;
  };
  latest_run: {
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
  } | null;
};

function getAdminBackendConfig() {
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

export async function listMerchantMaterialsOverview(input?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<MerchantOverviewResponse | null> {
  const config = getAdminBackendConfig();
  if (!config) {
    return null;
  }

  const url = new URL(`${config.baseUrl}/admin/platform/materials/merchants`);

  if (input?.q) {
    url.searchParams.set("q", input.q);
  }
  if (Number.isFinite(input?.limit)) {
    url.searchParams.set("limit", String(input?.limit));
  }
  if (Number.isFinite(input?.offset)) {
    url.searchParams.set("offset", String(input?.offset));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.adminToken}`,
      "x-medusa-access-token": config.adminToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MerchantOverviewResponse;
}

export async function getMerchantMaterialsDetail(
  sellerId: string
): Promise<MerchantMaterialsDetail | null> {
  const config = getAdminBackendConfig();
  if (!config || !sellerId) {
    return null;
  }

  const response = await fetch(
    `${config.baseUrl}/admin/platform/materials/merchants/${encodeURIComponent(
      sellerId
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.adminToken}`,
        "x-medusa-access-token": config.adminToken,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MerchantMaterialsDetail;
}

export async function listMaterialCategoryOptions(): Promise<
  MaterialCategoryOption[]
> {
  const config = getAdminBackendConfig();
  if (!config) {
    return [];
  }

  const response = await fetch(
    `${config.baseUrl}/admin/platform/materials/categories`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.adminToken}`,
        "x-medusa-access-token": config.adminToken,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    categories?: MaterialCategoryOption[];
  };

  return payload.categories ?? [];
}

export async function listMerchantFeedSourceRuns(
  sellerId: string,
  feedId: string
): Promise<FeedRun[]> {
  const config = getAdminBackendConfig();
  if (!config || !sellerId || !feedId) {
    return [];
  }

  const response = await fetch(
    `${config.baseUrl}/admin/platform/materials/merchants/${encodeURIComponent(
      sellerId
    )}/feed-sources/${encodeURIComponent(feedId)}/runs?limit=20`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.adminToken}`,
        "x-medusa-access-token": config.adminToken,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { runs?: FeedRun[] };
  return payload.runs ?? [];
}

export async function getMerchantFeedSourceMetrics(
  sellerId: string,
  feedId: string
): Promise<FeedMetrics | null> {
  const config = getAdminBackendConfig();
  if (!config || !sellerId || !feedId) {
    return null;
  }

  const response = await fetch(
    `${config.baseUrl}/admin/platform/materials/merchants/${encodeURIComponent(
      sellerId
    )}/feed-sources/${encodeURIComponent(feedId)}/metrics`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.adminToken}`,
        "x-medusa-access-token": config.adminToken,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as FeedMetrics;
}
