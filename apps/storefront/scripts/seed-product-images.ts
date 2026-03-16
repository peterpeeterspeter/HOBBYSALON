/**
 * Seed product images from Pexels and update platform products.
 * Run: npx tsx scripts/seed-product-images.ts
 * Requires: PEXELS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * 1. Downloads images from Pexels to public/landing/products/
 * 2. Updates featured_image_url in platform products table
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const PEXELS_API = "https://api.pexels.com/v1";

type PexelsPhoto = {
  id: number;
  src: { original: string; large: string; large2x: string; landscape: string; portrait: string };
};

type PexelsSearchResponse = { photos: PexelsPhoto[] };

async function searchPexels(
  query: string,
  orientation: "landscape" | "portrait" | "square"
): Promise<PexelsPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("PEXELS_API_KEY is not set in .env.local");

  const params = new URLSearchParams({ query, orientation, per_page: "1" });
  const res = await fetch(`${PEXELS_API}/search?${params}`, {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) throw new Error(`Pexels API error ${res.status}`);
  const data = (await res.json()) as PexelsSearchResponse;
  return data.photos[0] ?? null;
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function getBestSrc(photo: PexelsPhoto, orientation: string): string {
  if (orientation === "landscape") return photo.src.landscape || photo.src.large2x || photo.src.original;
  if (orientation === "portrait") return photo.src.portrait || photo.src.original;
  return photo.src.large2x || photo.src.large || photo.src.original;
}

/** Platform product slugs and Pexels search queries */
const PRODUCT_IMAGES: Array<{ id: string; slug: string; query: string; orientation: "square" | "landscape" }> = [
  { id: "44444444-4444-4444-4444-444444444401", slug: "handmade-crochet-scarf", query: "crochet scarf wool handmade", orientation: "square" },
  { id: "44444444-4444-4444-4444-444444444402", slug: "supply-yarn-bundle", query: "yarn wool bundle crafting", orientation: "square" },
  { id: "44444444-4444-4444-4444-444444444403", slug: "handmade-knitted-hat", query: "knitted hat wool handmade", orientation: "square" },
  { id: "44444444-4444-4444-4444-444444444404", slug: "supply-pattern-pdf", query: "crochet pattern amigurumi bear", orientation: "square" },
  { id: "44444444-4444-4444-4444-444444444405", slug: "handmade-pottery-mug", query: "handmade ceramic mug pottery", orientation: "square" },
  { id: "44444444-4444-4444-4444-444444444406", slug: "supply-bead-kit", query: "beads jewelry making crafts", orientation: "square" },
];

async function main() {
  const pexelsKey = process.env.PEXELS_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!pexelsKey) {
    console.error("PEXELS_API_KEY is required in .env.local");
    process.exit(1);
  }

  const canUpdateDb = !!(supabaseUrl && serviceKey);
  const supabase = canUpdateDb ? createClient(supabaseUrl!, serviceKey!) : null;
  if (!canUpdateDb) {
    console.warn("Supabase not configured — images only. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to update DB.\n");
  }
  const outDir = path.join(process.cwd(), "public", "landing", "products");
  fs.mkdirSync(outDir, { recursive: true });
  const force = process.argv.includes("--force");

  console.log("Seeding product images from Pexels → public/landing/products/\n");

  for (const { id, slug, query, orientation } of PRODUCT_IMAGES) {
    const filename = `${slug}.jpg`;
    const filepath = path.join(outDir, filename);
    const imageUrl = `/landing/products/${filename}`;

    if (fs.existsSync(filepath) && !force) {
      console.log(`  Skip ${filename} (exists)`);
      if (supabase) {
        const { error } = await supabase.from("products").update({ featured_image_url: imageUrl }).eq("id", id);
        if (error) console.warn(`  DB update ${slug}:`, error.message);
        else console.log(`  ✓ DB updated ${slug}`);
      }
      continue;
    }

    try {
      console.log(`  Searching: "${query}"...`);
      const photo = await searchPexels(query, orientation);
      if (!photo) {
        console.log(`  ✗ ${filename}: no Pexels results`);
        continue;
      }
      const src = getBestSrc(photo, orientation);
      const buffer = await downloadImage(src);
      fs.writeFileSync(filepath, buffer);
      console.log(`  ✓ ${filename} (Photo by Pexels #${photo.id})`);

      if (supabase) {
        const { error } = await supabase.from("products").update({ featured_image_url: imageUrl }).eq("id", id);
        if (error) console.warn(`  DB update failed:`, error.message);
        else console.log(`  ✓ DB updated ${slug}`);
      }
    } catch (e) {
      console.error(`  ✗ ${slug}:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("\nDone. Photos provided by Pexels (https://www.pexels.com)");
}

main().catch(console.error);
