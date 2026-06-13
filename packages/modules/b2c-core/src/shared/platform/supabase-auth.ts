import { getPlatformSupabaseConfig } from "./supabase-rest-client";

export type VerifiedSupabaseUser = {
  id: string;
  email: string;
};

export async function verifySupabaseAccessToken(
  accessToken: string
): Promise<VerifiedSupabaseUser | null> {
  const config = getPlatformSupabaseConfig();
  const anonKey =
    process.env.PLATFORM_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!config?.url || !anonKey) {
    return null;
  }

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    id?: string;
    email?: string;
  };

  if (!payload.id || !payload.email) {
    return null;
  }

  return {
    id: payload.id,
    email: payload.email.trim().toLowerCase(),
  };
}
