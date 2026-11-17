import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { conversionGeneration } from "./conversion-security.server";
import { PLATFORM_RETURN_COOKIE, validConsentGeneration, validPlatformChargeKind, type PlatformChargeKind } from "./conversions";

const TTL = 1800;
export const platformReturnCookieOptions = { path: "/", secure: true, sameSite: "lax" as const, httpOnly: false, maxAge: TTL };
export function safePlatformOrigin(url: URL): boolean {
  return url.protocol === "https:" && !url.port && !url.username && !url.password && /^(www\.)?hobbysalon\.(be|nl)$/.test(url.hostname);
}
async function currentOrigin(): Promise<string | null> {
  try {
    const host = (await headers()).get("host");
    if (!host) return null;
    const url = new URL(`https://${host}`);
    return safePlatformOrigin(url) && url.host === host ? url.origin : null;
  } catch { return null; }
}
export async function platformReturnUrl(kind: PlatformChargeKind): Promise<string> {
  const origin = await currentOrigin() ?? "https://www.hobbysalon.be";
  return `${origin}/api/analytics/platform-return?kind=${kind}&session_id={CHECKOUT_SESSION_ID}`;
}
type ReturnState = {
  nonce: string; charge_kind: PlatformChargeKind; generation: string;
  expiresAt: number; sessionId: string; origin: string;
};
function signature(body: string): string | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) return null;
  const key = createHmac("sha256", secret).update("hobbysalon:platform-return:v1").digest();
  return createHmac("sha256", key).update(body).digest("hex");
}
// Only the actual Stripe create result is passed here, never a browser session ID.
export async function rememberPlatformReturn(kind: PlatformChargeKind, sessionId: string): Promise<void> {
  try {
    const generation = await conversionGeneration();
    if (!generation || !/^cs_[A-Za-z0-9_]{1,250}$/.test(sessionId)) return;
    const origin = await currentOrigin();
    if (!origin) return;
    const body = Buffer.from(JSON.stringify({ nonce: randomUUID(), charge_kind: kind, generation,
      expiresAt: Date.now() + TTL * 1000, sessionId, origin } satisfies ReturnState)).toString("base64url");
    const mac = signature(body);
    if (!mac || await conversionGeneration() !== generation) return;
    (await cookies()).set(PLATFORM_RETURN_COOKIE, `${body}.${mac}`, platformReturnCookieOptions);
  } catch { /* Optional measurement must never block Stripe checkout. */ }
}
export function verifyPlatformReturn(raw: string, generation: string, url: URL): ReturnState | null {
  try {
    if (!safePlatformOrigin(url) || raw.length > 2048) return null;
    const [body, mac, extra] = raw.split(".");
    if (extra !== undefined || !body || !/^[a-f0-9]{64}$/.test(mac ?? "")) return null;
    const expected = signature(body);
    if (!expected || !timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"))) return null;
    const state = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!validConsentGeneration(state.nonce) || !validPlatformChargeKind(state.charge_kind) ||
        !validConsentGeneration(state.generation) || state.generation !== generation || state.origin !== url.origin ||
        !Number.isSafeInteger(state.expiresAt) || state.expiresAt <= Date.now() || state.expiresAt > Date.now() + TTL * 1000 ||
        typeof state.sessionId !== "string" || !/^cs_[A-Za-z0-9_]{1,250}$/.test(state.sessionId) ||
        url.searchParams.getAll("session_id").length !== 1 || url.searchParams.getAll("kind").length !== 1 ||
        state.sessionId !== url.searchParams.get("session_id") || state.charge_kind !== url.searchParams.get("kind")) return null;
    return state;
  } catch { return null; }
}
