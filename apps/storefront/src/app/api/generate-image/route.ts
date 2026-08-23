/**
 * API route for LaoZhang Nano Banana Pro image generation.
 * Used by build scripts or admin tools. Requires LAOZHANG_API_KEY.
 * POST body: { prompt: string, aspectRatio?: string, imageSize?: string }
 * @see https://docs.laozhang.ai/en/api-capabilities/nano-banana-pro-image
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { generateImage } from "@/lib/laozhang/client";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: "Je moet ingelogd zijn." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { prompt, aspectRatio = "16:9", imageSize = "2K" } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt (string) is required" },
        { status: 400 }
      );
    }

    const base64 = await generateImage({
      prompt,
      aspectRatio: aspectRatio as "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9" | "3:2" | "2:3" | "5:4" | "4:5",
      imageSize: imageSize as "1K" | "2K" | "4K",
    });

    return NextResponse.json({ image: base64, format: "base64" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
