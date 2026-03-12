/**
 * Seed placeholder images from Pexels API.
 * Run: npx tsx scripts/seed-placeholder-images.ts
 * Requires: PEXELS_API_KEY in .env.local (get free key at https://www.pexels.com/api)
 *
 * Images are saved to public/landing/
 * @see https://www.pexels.com/api/documentation/#photos
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const PEXELS_API = "https://api.pexels.com/v1";

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  src: {
    original: string;
    large: string;
    large2x: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
  };
};

type PexelsSearchResponse = {
  photos: PexelsPhoto[];
  next_page?: string;
};

async function searchPexels(
  query: string,
  orientation: "landscape" | "portrait" | "square",
  size: "large" | "medium" | "small" = "large"
): Promise<PexelsPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is not set in .env.local");
  }

  const params = new URLSearchParams({
    query,
    orientation,
    size,
    per_page: "1",
  });

  const res = await fetch(`${PEXELS_API}/search?${params}`, {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    throw new Error(`Pexels API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as PexelsSearchResponse;
  return data.photos[0] ?? null;
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

const PLACEHOLDERS: Array<{
  filename: string;
  query: string;
  orientation: "landscape" | "portrait" | "square";
}> = [
  // Landing page
  { filename: "hero.jpg", query: "creative crafting workshop people", orientation: "landscape" },
  { filename: "crafts-grid.jpg", query: "handmade crafts artisan wool ceramic", orientation: "square" },
  { filename: "workshop.jpg", query: "craft workshop interior pottery", orientation: "landscape" },
  { filename: "community.jpg", query: "craft market handmade fair people", orientation: "landscape" },
  // Empty states
  { filename: "empty-crafts.jpg", query: "empty wooden table minimal warm", orientation: "square" },
  { filename: "empty-search.jpg", query: "empty shelf minimalist warm tones", orientation: "landscape" },
  // Card fallbacks
  { filename: "placeholder-product.jpg", query: "neutral cream beige background minimal", orientation: "square" },
  { filename: "placeholder-workshop.jpg", query: "craft workshop learning hands", orientation: "landscape" },
  { filename: "placeholder-event.jpg", query: "craft fair market event people", orientation: "landscape" },
  { filename: "placeholder-article.jpg", query: "creative writing blog craft inspiration", orientation: "landscape" },
  { filename: "placeholder-creator.jpg", query: "artist maker creative person studio", orientation: "square" },
  { filename: "placeholder-project.jpg", query: "diy craft project materials", orientation: "square" },
  // Domain/hero
  { filename: "domain-hero.jpg", query: "creative studio workspace warm light", orientation: "landscape" },
  // Generic fallbacks
  { filename: "placeholder-default.jpg", query: "craft hobby creative warm", orientation: "landscape" },
];

function getBestSrc(photo: PexelsPhoto, orientation: string): string {
  if (orientation === "landscape") return photo.src.landscape || photo.src.large2x || photo.src.original;
  if (orientation === "portrait") return photo.src.portrait || photo.src.original;
  return photo.src.large2x || photo.src.large || photo.src.original;
}

async function main() {
  const force = process.argv.includes("--force");
  const outDir = path.join(process.cwd(), "public", "landing");
  fs.mkdirSync(outDir, { recursive: true });
  console.log("Seeding placeholder images from Pexels → public/landing/\n");

  for (const { filename, query, orientation } of PLACEHOLDERS) {
    const filepath = path.join(outDir, filename);
    if (fs.existsSync(filepath) && !force) {
      console.log(`  Skip ${filename} (exists, use --force to overwrite)`);
      continue;
    }
    try {
      console.log(`  Searching: "${query}" (${orientation})...`);
      const photo = await searchPexels(query, orientation);
      if (!photo) {
        console.log(`  ✗ ${filename}: no results`);
        continue;
      }
      const src = getBestSrc(photo, orientation);
      const buffer = await downloadImage(src);
      fs.writeFileSync(filepath, buffer);
      console.log(`  ✓ ${filename} (Photo by Pexels #${photo.id})`);
    } catch (e) {
      console.error(`  ✗ ${filename}:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 300)); // rate limit
  }

  console.log("\nDone. Photos provided by Pexels (https://www.pexels.com)");
}

main().catch(console.error);
