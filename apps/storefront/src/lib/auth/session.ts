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
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.hobbysalon.be"
  ).replace(/\/$/, "");
  const confirmationUrl = new URL("/auth/confirm", siteUrl);
  if (nextPath?.startsWith("/") && !nextPath.startsWith("//")) {
    confirmationUrl.searchParams.set("next", nextPath);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmationUrl.toString(),
      data: metadata,
    },
  });

  return {
    user: data.user ?? null,
    session: data.session ?? null,
    error: error?.message ?? null,
  };
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
