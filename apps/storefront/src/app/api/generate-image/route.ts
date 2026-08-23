/**
 * API route for LaoZhang Nano Banana Pro image generation.
 * Requires an authenticated session and is rate-limited per user.
 * POST body: { prompt: string, aspectRatio?: string, imageSize?: string }
 * @see https://docs.laozhang.ai/en/api-capabilities/nano-banana-pro-image
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { generateImage } from "@/lib/laozhang/client";
import {
  checkImageGenerationRateLimit,
  recordImageGeneration,
} from "@/lib/media/image-generation-limits";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: "Je moet ingelogd zijn." },
      { status: 401 }
    );
  }

  const limit = await checkImageGenerationRateLimit(user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Te veel generaties dit uur. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 3600) } }
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

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: "prompt is te lang (max 2000 tekens)" },
        { status: 400 }
      );
    }

    const base64 = await generateImage({
      prompt,
      aspectRatio: aspectRatio as "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9" | "3:2" | "2:3" | "5:4" | "4:5",
      imageSize: imageSize as "1K" | "2K" | "4K",
    });

    await recordImageGeneration(user.id);

    return NextResponse.json({ image: base64, format: "base64" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
