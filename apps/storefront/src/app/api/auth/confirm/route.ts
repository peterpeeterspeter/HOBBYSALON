import { NextResponse } from "next/server";
import {
  consumeAuthNextPath,
  persistAuthSession,
  validateAuthSession,
} from "@/lib/auth/session";
import { resolvePostAuthRedirectPath } from "@/lib/auth/post-auth";

type ConfirmationBody = {
  accessToken?: unknown;
  refreshToken?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ConfirmationBody | null;
  const accessToken =
    typeof body?.accessToken === "string" ? body.accessToken : "";
  const refreshToken =
    typeof body?.refreshToken === "string" ? body.refreshToken : "";

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Missing confirmation tokens." }, { status: 400 });
  }

  const session = await validateAuthSession(accessToken, refreshToken);
  if (!session) {
    return NextResponse.json({ error: "Invalid or expired confirmation." }, { status: 401 });
  }

  await persistAuthSession(session);

  // Cookie is bootstrap only; DB intent wins when cookie is missing/stale.
  const cookieNext = await consumeAuthNextPath("");
  const next = await resolvePostAuthRedirectPath({
    userId: session.user?.id ?? null,
    requestedNextPath: cookieNext || null,
    defaultPath: "/profile",
  });

  return NextResponse.json({ ok: true, next });
}
