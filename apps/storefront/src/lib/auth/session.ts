import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, type Session, type User } from "@supabase/supabase-js";

export const AUTH_ACCESS_COOKIE = "hs_auth_access";
export const AUTH_REFRESH_COOKIE = "hs_auth_refresh";

const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase auth env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

const getUserForAccessToken = cache(async (accessToken: string): Promise<User | null> => {
  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) return null;
  return data.user ?? null;
});

export async function getAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return null;
  }
  return getUserForAccessToken(accessToken);
}

export async function getAuthAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_ACCESS_COOKIE)?.value ?? null;
}

export async function resolveSupabaseAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_ACCESS_COOKIE)?.value ?? null;
  const refreshToken = cookieStore.get(AUTH_REFRESH_COOKIE)?.value ?? null;

  if (accessToken) {
    const user = await getUserForAccessToken(accessToken);
    if (user) {
      return accessToken;
    }
  }

  if (accessToken && refreshToken) {
    const session = await validateAuthSession(accessToken, refreshToken);
    if (session) {
      await persistAuthSession(session);
      return session.access_token;
    }
  }

  return accessToken;
}

export async function hasAuthSessionCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(AUTH_ACCESS_COOKIE)?.value);
}

export async function createEmailSession(
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return {
    user: data.user ?? null,
    session: data.session ?? null,
    error: error?.message ?? null,
  };
}

export async function registerEmailUser(
  email: string,
  password: string,
  nextPath?: string | null,
  metadata?: Record<string, unknown>
): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  const supabase = getSupabaseAuthClient();
  const confirmationUrl = buildAuthConfirmUrl(nextPath);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmationUrl,
      data: metadata,
    },
  });

  return {
    user: data.user ?? null,
    session: data.session ?? null,
    error: error?.message ?? null,
  };
}

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.hobbysalon.be").replace(
    /\/$/,
    ""
  );
}

/** Strip hash fragments; they break Supabase redirect allowlisting and Location headers. */
export function sanitizeAuthNextPath(nextPath?: string | null): string | null {
  if (!nextPath?.startsWith("/") || nextPath.startsWith("//")) return null;
  const withoutHash = nextPath.split("#", 1)[0]?.trim() ?? "";
  return withoutHash || null;
}

export function buildAuthConfirmUrl(nextPath?: string | null): string {
  const confirmationUrl = new URL("/auth/confirm", getSiteUrl());
  const safeNext = sanitizeAuthNextPath(nextPath);
  if (safeNext) {
    confirmationUrl.searchParams.set("next", safeNext);
  }
  return confirmationUrl.toString();
}

export async function sendPasswordResetEmail(
  email: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseAuthClient();
  const redirectTo = buildAuthConfirmUrl("/auth/update-password");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  return { error: error?.message ?? null };
}

export async function validateAuthSession(
  accessToken: string,
  refreshToken: string
): Promise<Session | null> {
  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) return null;
  return data.session;
}

export async function persistAuthSession(session: Session): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  cookieStore.set(AUTH_REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export async function clearAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set(AUTH_REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
