import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { RavelryClient, type RavelryPatternDetail } from "../src/lib/integrations/ravelry/client";

type Args = {
  apply: boolean;
  query: string | null;
  craft: string;
  language: string;
  freeOnly: boolean;
  pageSize: number;
  pages: number;
  limit: number;
  fallbackDomainSlug: string | null;
  authorCreatorId: string | null;
  delayMs: number;
};

type DomainRow = {
  id: string;
  slug: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    query: null,
    craft: "crochet",
    language: "nl",
    freeOnly: true,
    pageSize: 20,
    pages: 2,
    limit: 40,
    fallbackDomainSlug: "crochet",
    authorCreatorId: null,
    delayMs: 150,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--apply") {
      args.apply = true;
      continue;
    }

    if (arg === "--include-paid") {
      args.freeOnly = false;
      continue;
    }

    if (arg === "--query" && argv[i + 1]) {
      args.query = argv[i + 1].trim() || null;
      i += 1;
      continue;
    }

    if (arg === "--craft" && argv[i + 1]) {
      args.craft = argv[i + 1].trim();
      i += 1;
      continue;
    }

    if (arg === "--language" && argv[i + 1]) {
      args.language = argv[i + 1].trim();
      i += 1;
      continue;
    }

    if (arg === "--page-size" && argv[i + 1]) {
      args.pageSize = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg === "--pages" && argv[i + 1]) {
      args.pages = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg === "--limit" && argv[i + 1]) {
      args.limit = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg === "--fallback-domain-slug" && argv[i + 1]) {
      args.fallbackDomainSlug = argv[i + 1].trim().toLowerCase() || null;
      i += 1;
      continue;
    }

    if (arg === "--author-creator-id" && argv[i + 1]) {
      args.authorCreatorId = argv[i + 1].trim() || null;
      i += 1;
      continue;
    }

    if (arg === "--delay-ms" && argv[i + 1]) {
      args.delayMs = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
  }

  if (!Number.isInteger(args.pageSize) || args.pageSize < 1 || args.pageSize > 100) {
    throw new Error("--page-size must be an integer between 1 and 100");
  }

  if (!Number.isInteger(args.pages) || args.pages < 1 || args.pages > 20) {
    throw new Error("--pages must be an integer between 1 and 20");
  }

  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 1000) {
    throw new Error("--limit must be an integer between 1 and 1000");
  }

  if (!Number.isInteger(args.delayMs) || args.delayMs < 0 || args.delayMs > 10000) {
    throw new Error("--delay-ms must be an integer between 0 and 10000");
  }

  return args;
}

function toSlug(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);

  return normalized || `ravelry-pattern-${Date.now()}`;
}

function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function parsePublishedDate(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(normalized)) {
    return `${normalized.replace(/\//g, "-")}T00:00:00.000Z`;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function truncate(input: string, max: number): string {
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trim()}…`;
}

function cleanNotes(notes: string | null): string | null {
  if (!notes) return null;
  const cleaned = notes
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function buildPatternMarkdown(pattern: RavelryPatternDetail): string {
  const lines: string[] = [];
  const patternUrl = pattern.url ?? (pattern.permalink ? `https://www.ravelry.com/patterns/library/${pattern.permalink}` : null);

  lines.push(`## ${pattern.name}`, "");

  if (pattern.designerName) {
    lines.push(`Designer: ${pattern.designerName}`, "");
  }

  lines.push(`Gratis patroon: ${pattern.free ? "Ja" : "Nee"}`, "");

  if (pattern.languageCodes.length > 0) {
    lines.push(`Beschikbare talen: ${pattern.languageCodes.join(", ")}`, "");
  }

  if (pattern.patternTypeName) {
    lines.push(`Type: ${pattern.patternTypeName}`, "");
  }

  if (pattern.categoryNames.length > 0) {
    lines.push(`Categorieen: ${pattern.categoryNames.join(", ")}`, "");
  }

  if (patternUrl) {
    lines.push(`Bron: ${patternUrl}`, "");
  }

  if (pattern.pdfUrl) {
    lines.push(`PDF: ${pattern.pdfUrl}`, "");
  }

  const notes = cleanNotes(pattern.notes);
  if (notes) {
    lines.push("### Beschrijving", "", notes, "");
  }

  lines.push(
    "_Bron: Ravelry API. Controleer altijd de actuele voorwaarden en beschikbaarheid op de bronpagina._"
  );

  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchPatternCandidates(args: Args): Promise<RavelryPatternDetail[]> {
  const client = RavelryClient.fromEnv();
  const seenPatternIds = new Set<number>();
  const patternIds: number[] = [];

  for (let page = 1; page <= args.pages; page += 1) {
    const { patterns } = await client.searchPatterns({
      query: args.query ?? undefined,
      craft: args.craft,
      language: args.language,
      availability: args.freeOnly ? "free" : "all",
      page,
      pageSize: args.pageSize,
    });

    for (const pattern of patterns) {
      if (args.freeOnly && !pattern.free) continue;
      if (seenPatternIds.has(pattern.id)) continue;
      seenPatternIds.add(pattern.id);
      patternIds.push(pattern.id);

      if (patternIds.length >= args.limit) break;
    }

    if (patternIds.length >= args.limit) break;
    if (patterns.length < args.pageSize) break;
  }

  const details: RavelryPatternDetail[] = [];
  for (const id of patternIds) {
    const detail = await client.getPattern(id);
    details.push(detail);
    if (args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  return details;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const patterns = await fetchPatternCandidates(args);

  if (!args.apply) {
    const preview = patterns.slice(0, 10).map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      free: pattern.free,
      languages: pattern.languageCodes,
      slug: toSlug(`ravelry-pattern-${pattern.id}-${pattern.permalink ?? pattern.name}`),
      url: pattern.url,
    }));

    console.log(JSON.stringify({ count: patterns.length, preview }, null, 2));
    console.log("\nDry run complete. Use --apply to upsert into Supabase.");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (required for --apply)");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: domainRows, error: domainError } = await supabase
    .from("domains")
    .select("id,slug")
    .eq("is_active", true);

  if (domainError) {
    throw new Error(`Failed to load domains: ${domainError.message}`);
  }

  const domains = (domainRows ?? []) as DomainRow[];
  const fallbackDomainId = args.fallbackDomainSlug
    ? (domains.find((domain) => domain.slug === args.fallbackDomainSlug)?.id ?? null)
    : null;

  let upserted = 0;

  for (const pattern of patterns) {
    const slug = toSlug(`ravelry-pattern-${pattern.id}-${pattern.permalink ?? pattern.name}`);
    const notes = cleanNotes(pattern.notes);
    const excerptBase = notes
      ? truncate(notes, 220)
      : `${pattern.name} op Ravelry${pattern.designerName ? ` van ${pattern.designerName}` : ""}.`;

    const payload = {
      slug,
      title: `Ravelry patroon: ${pattern.name}`,
      excerpt: excerptBase,
      body_markdown: buildPatternMarkdown(pattern),
      article_type: "pattern",
      reading_time_minutes: estimateReadingTime(notes ?? pattern.name),
      published_at: parsePublishedDate(pattern.published) ?? new Date().toISOString(),
      is_published: true,
      is_featured: false,
      author_creator_id: args.authorCreatorId,
      domain_id: fallbackDomainId,
      featured_image_url: pattern.firstPhotoUrl,
      seo_title: `${pattern.name} | Gratis haakpatroon | Hobbysalon`,
      seo_description: truncate(excerptBase, 155),
    };

    const { error } = await supabase.from("articles").upsert(payload, { onConflict: "slug" });
    if (error) {
      throw new Error(`Failed to upsert pattern ${pattern.id} (${pattern.name}): ${error.message}`);
    }

    upserted += 1;
  }

  console.log(`Imported ${upserted} Ravelry pattern article(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
