import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";

export const AUTH_ACCESS_COOKIE = "hs_auth_access";
export const AUTH_REFRESH_COOKIE = "hs_auth_refresh";
/** Post-auth internal path after email confirm (never put this in emailRedirectTo). */
export const AUTH_NEXT_COOKIE = "hs_auth_next";

const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const NEXT_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

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

/**
 * Refresh may succeed even when cookie writes are blocked (RSC render).
 * Cookie mutation is only allowed in Server Actions / Route Handlers.
 */
async function tryPersistAuthSession(session: Session): Promise<void> {
  try {
    await persistAuthSession(session);
  } catch {
    // Ignore — caller still gets a valid user for this request.
  }
}

async function refreshAuthSession(
  accessToken: string | null,
  refreshToken: string
): Promise<Session | null> {
  if (accessToken) {
    const fromSetSession = await validateAuthSession(accessToken, refreshToken);
    if (fromSetSession) return fromSetSession;
  }

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error) return null;
  return data.session;
}

export const getAuthUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_ACCESS_COOKIE)?.value ?? null;
  const refreshToken = cookieStore.get(AUTH_REFRESH_COOKIE)?.value ?? null;

  if (accessToken) {
    const user = await getUserForAccessToken(accessToken);
    if (user) return user;
  }

  if (refreshToken) {
    const session = await refreshAuthSession(accessToken, refreshToken);
    if (session?.user) {
      await tryPersistAuthSession(session);
      return session.user;
    }
  }

  return null;
});

export async function getAuthAccessToken(): Promise<string | null> {
  return resolveSupabaseAccessToken();
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

  if (refreshToken) {
    const session = await refreshAuthSession(accessToken, refreshToken);
    if (session) {
      await tryPersistAuthSession(session);
      return session.access_token;
    }
  }

  return null;
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
  metadata?: Record<string, unknown>,
  captchaToken?: string | null
): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  const supabase = getSupabaseAuthClient();
  // Keep emailRedirectTo allowlist-safe and stable. Nested ?next=…/#… caused
  // signup failures; retries then burned the project-wide email rate limit.
  await persistAuthNextPath(nextPath);
  const confirmationUrl = buildAuthConfirmUrl();

  const captcha = await verifyTurnstileToken(captchaToken);
  if (!captcha.ok) {
    return { user: null, session: null, error: captcha.error ?? "captcha-failed" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmationUrl,
      data: metadata,
      captchaToken: captchaToken ?? undefined,
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

/** Strip hash fragments; they break Location headers and must not enter auth redirects. */
export function sanitizeAuthNextPath(nextPath?: string | null): string | null {
  if (!nextPath?.startsWith("/") || nextPath.startsWith("//")) return null;
  const withoutHash = nextPath.split("#", 1)[0]?.trim() ?? "";
  return withoutHash || null;
}

export async function persistAuthNextPath(nextPath?: string | null): Promise<void> {
  const cookieStore = await cookies();
  const safeNext = sanitizeAuthNextPath(nextPath);
  if (!safeNext) {
    cookieStore.set(AUTH_NEXT_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return;
  }

  cookieStore.set(AUTH_NEXT_COOKIE, safeNext, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: NEXT_COOKIE_MAX_AGE,
  });
}

export async function consumeAuthNextPath(
  fallback = "/profile"
): Promise<string> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_NEXT_COOKIE)?.value ?? null;
  const safeNext = sanitizeAuthNextPath(raw) ?? fallback;
  cookieStore.set(AUTH_NEXT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return safeNext;
}

/**
 * Stable Supabase allowlist target. Do not append ?next= — store next in
 * AUTH_NEXT_COOKIE via persistAuthNextPath instead.
 */
export function buildAuthConfirmUrl(_nextPath?: string | null): string {
  return new URL("/auth/confirm", getSiteUrl()).toString();
}

export async function sendPasswordResetEmail(
  email: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseAuthClient();
  await persistAuthNextPath("/auth/update-password");
  const redirectTo = buildAuthConfirmUrl();
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
