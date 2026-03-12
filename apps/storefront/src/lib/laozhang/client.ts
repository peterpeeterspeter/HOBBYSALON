/**
 * LaoZhang API client for Nano Banana Pro (Gemini 3) image generation.
 * Server-side only. API key from LAOZHANG_API_KEY env.
 * @see https://docs.laozhang.ai/en/api-capabilities/nano-banana-pro-image
 */

const API_BASE = "https://api.laozhang.ai";
const MODEL = "gemini-3-pro-image-preview";

type AspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "21:9"
  | "3:2"
  | "2:3"
  | "5:4"
  | "4:5";
type ImageSize = "1K" | "2K" | "4K";

export type GenerateImageOptions = {
  prompt: string;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<string> {
  const apiKey = process.env.LAOZHANG_API_KEY;
  if (!apiKey) {
    throw new Error("LAOZHANG_API_KEY is not set");
  }

  const { prompt, aspectRatio = "16:9", imageSize = "2K" } = options;

  const url = `${API_BASE}/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LaoZhang API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data: string } }> };
    }>;
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`LaoZhang API: ${data.error.message}`);
  }

  const base64 =
    data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64) {
    throw new Error("LaoZhang API: no image data in response");
  }

  return base64;
}
