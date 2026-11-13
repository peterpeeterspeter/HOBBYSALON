import { NextResponse, type NextRequest } from "next/server";
import { createPlatformClient } from "@/lib/platform/client";
import { countPageview } from "@/lib/analytics/consent-counter.server";

/**
 * Counts one pageview, whatever the visitor chose.
 *
 * This exists because GA4 cannot answer the only question that makes its own
 * numbers honest: how much traffic the consent gate is hiding. Denied visitors
 * send nothing to Google, so this route is the sole record that they were here.
 *
 * Deliberately stateless and anonymous: no cookie is set, no identifier is read
 * or written, and the body carries only a route template. It is safe (and
 * intended) for this to run for visitors who refused analytics, because it
 * records nothing about them beyond "someone loaded this template".
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A plain object body keeps the request a CORS "simple request": no preflight,
// so a keepalive beacon survives the navigation that triggered it.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      path?: unknown;
      consent?: unknown;
    };
    const path = typeof body.path === "string" ? body.path : "";
    const consent = body.consent === "granted" ? "granted" : "denied";
    const host = request.headers.get("host") ?? "";

    if (!path) return new NextResponse(null, { status: 204 });

    // Never let a slow database hold the response open.
    await countPageview(createPlatformClient(), { path, host, consent });
    return new NextResponse(null, { status: 204 });
  } catch {
    // A counter failure is not a page failure.
    return new NextResponse(null, { status: 204 });
  }
}
