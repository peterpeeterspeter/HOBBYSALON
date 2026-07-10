import "server-only";

function getBackendUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL ??
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    "http://localhost:9000"
  ).replace(/\/$/, "");
}

async function loginMedusaAdmin(
  email: string,
  password: string
): Promise<string | null> {
  const response = await fetch(`${getBackendUrl()}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { token?: string };
  return payload.token?.trim() || null;
}

export async function resolveMedusaAdminToken(): Promise<string | null> {
  const email = process.env.MEDUSA_ADMIN_EMAIL?.trim();
  const password = process.env.MEDUSA_ADMIN_PASSWORD?.trim();

  if (email && password) {
    const token = await loginMedusaAdmin(email, password);
    if (token) {
      return token;
    }
  }

  return (
    process.env.MEDUSA_ADMIN_API_TOKEN?.trim() ||
    process.env.MEDUSA_ADMIN_TOKEN?.trim() ||
    process.env.MEDUSA_BACKEND_ADMIN_TOKEN?.trim() ||
    null
  );
}

export type MedusaAdminBackendConfig = {
  baseUrl: string;
  adminToken: string;
};

export async function getMedusaAdminBackendConfig(): Promise<MedusaAdminBackendConfig | null> {
  const adminToken = await resolveMedusaAdminToken();
  if (!adminToken) {
    return null;
  }

  return {
    baseUrl: getBackendUrl(),
    adminToken,
  };
}

export async function hasMedusaAdminAccess(): Promise<boolean> {
  return (await resolveMedusaAdminToken()) !== null;
}
