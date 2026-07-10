/**
 * Attaches the default Medusa sales channel to products that are missing one.
 * Creator auto-provisioned products are invisible in the Store API until linked.
 *
 * Usage:
 *   MEDUSA_BACKEND_URL=https://api.hobbysalon.be \
 *   MEDUSA_ADMIN_API_TOKEN=<jwt> \
 *   npx tsx scripts/attach-default-sales-channel.ts
 *
 * Or omit MEDUSA_ADMIN_API_TOKEN to log in as admin@mercurjs.com (dev seed password).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const medusaUrl = (
  process.env.MEDUSA_BACKEND_URL ??
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  "http://localhost:9000"
).replace(/\/$/, "");

const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

function resolveEnv(name: string): string {
  const value = process.env[name]?.trim();
  return value ?? "";
}

async function getAdminToken(): Promise<string> {
  const configured = resolveEnv("MEDUSA_ADMIN_API_TOKEN");
  if (configured) return configured;

  const response = await fetch(`${medusaUrl}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@mercurjs.com",
      password: "supersecret",
    }),
  });

  if (!response.ok) {
    throw new Error(`Admin login failed (${response.status})`);
  }

  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error("Admin login returned no token");
  }

  return payload.token;
}

type AdminProduct = {
  id: string;
  handle?: string | null;
  sales_channels?: Array<{ id: string }>;
};

async function adminFetch<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${medusaUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-medusa-access-token": token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${path} failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

async function main() {
  const token = await getAdminToken();

  const channels = await adminFetch<{ sales_channels: Array<{ id: string; name?: string }> }>(
    token,
    "/admin/sales-channels?limit=5"
  );
  const defaultChannel =
    channels.sales_channels.find((c) => c.name === "Default Sales Channel") ??
    channels.sales_channels[0];

  if (!defaultChannel?.id) {
    throw new Error("No sales channel found");
  }

  const listed = await adminFetch<{ products: AdminProduct[] }>(
    token,
    "/admin/products?limit=200&fields=id,handle,*sales_channels"
  );

  let attached = 0;
  let skipped = 0;

  for (const product of listed.products ?? []) {
    if (product.sales_channels?.length) {
      skipped += 1;
      continue;
    }

    await adminFetch(token, `/admin/products/${product.id}`, {
      method: "POST",
      body: JSON.stringify({
        sales_channels: [{ id: defaultChannel.id }],
      }),
    });

    attached += 1;
    console.warn(`Attached sales channel -> ${product.handle ?? product.id}`);
  }

  if (publishableKey) {
    const storeListed = await fetch(`${medusaUrl}/store/products?limit=200`, {
      headers: { "x-publishable-api-key": publishableKey },
    });
    const storePayload = (await storeListed.json()) as { count?: number };
    console.warn(
      `Done. attached=${attached} skipped=${skipped} store_visible=${storePayload.count ?? "?"}`
    );
  } else {
    console.warn(`Done. attached=${attached} skipped=${skipped}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
