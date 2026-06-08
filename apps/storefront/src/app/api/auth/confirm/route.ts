import { NextResponse } from "next/server";
import {
  persistAuthSession,
  validateAuthSession,
} from "@/lib/auth/session";

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
  return NextResponse.json({ ok: true });
}
