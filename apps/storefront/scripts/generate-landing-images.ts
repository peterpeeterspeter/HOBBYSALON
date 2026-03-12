/**
 * Generate landing page images via LaoZhang Nano Banana Pro API.
 * Run: npx tsx scripts/generate-landing-images.ts
 * Requires: LAOZHANG_API_KEY in .env.local
 *
 * Images are saved to public/landing/
 */
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const API_BASE = "https://api.laozhang.ai";
const MODEL = "gemini-3-pro-image-preview";

async function generateImage(
  prompt: string,
  aspectRatio: string,
  imageSize: string
): Promise<Buffer> {
  const apiKey = process.env.LAOZHANG_API_KEY;
  if (!apiKey) {
    throw new Error("LAOZHANG_API_KEY is not set in .env.local");
  }

  const url = `${API_BASE}/v1beta/models/${MODEL}:generateContent`;
  console.log(`  Generating: ${prompt.slice(0, 50)}...`);

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
        imageConfig: { aspectRatio, imageSize },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data: string } }> };
    }>;
    error?: { message: string };
  };

  if (data.error) throw new Error(data.error.message);
  const base64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64) throw new Error("No image in response");

  return Buffer.from(base64, "base64");
}

const IMAGES: Array<{ filename: string; prompt: string; aspectRatio: string }> = [
  {
    filename: "hero.jpg",
    aspectRatio: "16:9",
    prompt:
      "Warm, inviting scene of a creative crafting workshop. People of various ages around a wooden table with yarn, ceramics, and handmade supplies. Soft natural lighting, cozy atmosphere, terracotta and cream color palette. Style: soft focus, lifestyle photography, premium quality.",
  },
  {
    filename: "crafts-grid.jpg",
    aspectRatio: "1:1",
    prompt:
      "Artisan handmade crafts arrangement: hand-knitted scarf, ceramic mug, wooden spoon, dried flowers in vase. Overhead flat lay, warm beige background, natural materials. Style: minimalist, editorial.",
  },
  {
    filename: "workshop.jpg",
    aspectRatio: "4:3",
    prompt:
      "Cozy craft workshop interior. Instructor helping participant with pottery. Wooden shelves with supplies. Warm terracotta accents, natural light. Style: professional lifestyle photo.",
  },
  {
    filename: "community.jpg",
    aspectRatio: "16:9",
    prompt:
      "Diverse group of hobbyists at a creative market or fair. Handmade stalls, smiling people, crafts on display. Festive, welcoming atmosphere. Warm color palette. Style: documentary, authentic.",
  },
  // Design system images: empty states & placeholders
  {
    filename: "empty-crafts.jpg",
    aspectRatio: "1:1",
    prompt:
      "Minimalist illustration style: empty wooden craft table with soft morning light, subtle terracotta and cream tones. Gentle, inviting empty space. No people, no objects. Warm, hopeful mood. Style: soft editorial, Hobbysalon aesthetic.",
  },
  {
    filename: "empty-search.jpg",
    aspectRatio: "4:3",
    prompt:
      "Abstract warm-toned composition: empty shelves with soft shadows, terracotta and beige palette. Inviting blank canvas feeling. Minimal, editorial. Style: lifestyle, premium quality.",
  },
  {
    filename: "placeholder-product.jpg",
    aspectRatio: "1:1",
    prompt:
      "Neutral product placeholder: soft cream background with delicate craft texture, warm terracotta accent line. Minimal, elegant. Style: editorial flat lay.",
  },
  {
    filename: "domain-hero.jpg",
    aspectRatio: "16:9",
    prompt:
      "Generic creative hobby atmosphere: warm studio space with natural light, wooden elements, terracotta accents. Inviting, versatile. Style: professional lifestyle, Hobbysalon.",
  },
];

async function main() {
  const outDir = path.join(process.cwd(), "public", "landing");
  fs.mkdirSync(outDir, { recursive: true });
  console.log("Landing images → public/landing/\n");

  for (const { filename, prompt, aspectRatio } of IMAGES) {
    const filepath = path.join(outDir, filename);
    if (fs.existsSync(filepath)) {
      console.log(`  Skip ${filename} (exists)`);
      continue;
    }
    try {
      const buffer = await generateImage(prompt, aspectRatio, "2K");
      fs.writeFileSync(filepath, buffer);
      console.log(`  ✓ ${filename}`);
    } catch (e) {
      console.error(`  ✗ ${filename}:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 2000)); // rate limit
  }

  console.log("\nDone.");
}

main().catch(console.error);
