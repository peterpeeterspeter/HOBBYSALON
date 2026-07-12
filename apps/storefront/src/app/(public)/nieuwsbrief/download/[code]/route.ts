import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createPlatformClient } from "@/lib/platform/client";
import { verifyConfirmationToken } from "@/lib/newsletter/lead-magnet";

export const runtime = "nodejs";

type Props = { params: Promise<{ code: string }> };

export async function GET(request: NextRequest, { params }: Props) {
  const { code } = await params;
  const token = request.nextUrl.searchParams.get("token");
  const secret = process.env.NEWSLETTER_CONFIRMATION_SECRET?.trim();
  const payload = secret && token ? verifyConfirmationToken(token, secret) : null;
  if (!payload || payload.leadMagnetCode !== code) {
    return new NextResponse("Deze downloadlink is ongeldig.", { status: 400 });
  }

  const supabase = createPlatformClient();
  const { data: leadMagnet } = await supabase
    .from("newsletter_lead_magnets")
    .select("id")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (!leadMagnet) return new NextResponse("Deze download is niet beschikbaar.", { status: 404 });

  const { data: event } = await supabase
    .from("newsletter_opt_in_events")
    .select("id")
    .eq("email", payload.email)
    .eq("lead_magnet_id", leadMagnet.id)
    .eq("status", "confirmed")
    .maybeSingle();
  if (!event) return new NextResponse("Bevestig eerst je inschrijving.", { status: 403 });

  if (code !== "haak-startpakket-v1") return new NextResponse("Deze download is niet beschikbaar.", { status: 404 });
  const file = await readFile(path.join(process.cwd(), "src/lib/newsletter/assets/haken-startgids-v1.pdf"));
  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="hobbysalon-startgids-haken.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
