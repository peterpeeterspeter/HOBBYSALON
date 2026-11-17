import { NextResponse, type NextRequest } from "next/server";
import { createPlatformClient } from "@/lib/platform/client";
import { countPageview } from "@/lib/analytics/consent-counter.server";

/** Aggregate route arrivals by consent state; pending belongs to denied.
 * A 204 is best-effort acknowledgement, not proof of a persisted count.
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

    // Best effort: response status deliberately does not expose a write failure.
    await countPageview(createPlatformClient(), { path, host, consent });
    return new NextResponse(null, { status: 204 });
  } catch {
    // A counter failure is not a page failure.
    return new NextResponse(null, { status: 204 });
  }
}
