import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { recordPassportActivityFromEvent } from "@/lib/platform/queries/hobby-passport";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const payload = body as Record<string, unknown>;
  const eventName = typeof payload.event === "string" ? payload.event : null;
  if (!eventName) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  try {
    await recordPassportActivityFromEvent(user.id, eventName, payload);
  } catch {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
