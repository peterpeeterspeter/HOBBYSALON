import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

type Args = {
  dirPath: string;
  apply: boolean;
  limit: number | null;
  fallbackDomainSlug: string | null;
};

type DomainRow = {
  id: string;
  slug: string;
  name: string;
};

type ParsedSource = {
  fileName: string;
  sourceName: string;
  sourceDescription: string | null;
  sourceWebsite: string | null;
  language: string | null;
  links: Array<{ title: string; url: string }>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dirPath: path.resolve(process.cwd(), "data/import/free-crochet-sources"),
    apply: false,
    limit: null,
    fallbackDomainSlug: "crochet",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--apply") {
      args.apply = true;
      continue;
    }

    if (arg === "--dir" && argv[i + 1]) {
      args.dirPath = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--limit" && argv[i + 1]) {
      args.limit = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg === "--fallback-domain-slug" && argv[i + 1]) {
      args.fallbackDomainSlug = argv[i + 1].trim().toLowerCase();
      i += 1;
      continue;
    }
  }

  if (args.limit !== null && (Number.isNaN(args.limit) || args.limit < 1)) {
    throw new Error("Invalid --limit value");
  }

  return args;
}

function decodeHtml(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number.parseInt(code, 10);
      return Number.isNaN(n) ? "" : String.fromCodePoint(n);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => {
      const n = Number.parseInt(code, 16);
      return Number.isNaN(n) ? "" : String.fromCodePoint(n);
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(input: string): string {
  return decodeHtml(input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function toSlug(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);

  return normalized || `gratis-haakpatronen-${Date.now()}`;
}

function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function extractField(html: string, label: string): string | null {
  const regex = new RegExp(
    `<p><strong>${label}:<\\/strong>\\s*([\\s\\S]*?)<\\/p>`,
    "i"
  );
  const match = html.match(regex);
  return match?.[1] ? stripTags(match[1]) : null;
}

function parseSourceHtml(fileName: string, html: string): ParsedSource {
  const h1Match = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  const sourceName = stripTags(h1Match?.[1] ?? fileName.replace(/\.html$/i, ""));
  const sourceDescription = extractField(html, "Description");
  const language = extractField(html, "Language");

  const websiteMatch = html.match(
    /<p><strong>Website:<\/strong>\s*<a[^>]*href="([^"]+)"[^>]*>/i
  );
  const sourceWebsite = websiteMatch?.[1]?.trim() ?? null;

  const linkRegex =
    /<div class="pattern-title">\s*\d+\.\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/div>/gi;
  const rawLinks: Array<{ title: string; url: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = (match[1] ?? "").trim();
    const title = stripTags(match[2] ?? "");
    if (!url.startsWith("http")) continue;
    if (!title) continue;
    rawLinks.push({ title, url });
  }

  const uniqueByUrl = new Map<string, { title: string; url: string }>();
  for (const row of rawLinks) {
    if (!uniqueByUrl.has(row.url)) {
      uniqueByUrl.set(row.url, row);
    }
  }

  const positiveKeyword = /(gratis|free|haak|crochet|patroon|pattern)/i;
  const negativeKeyword = /(paid|betaald|checkout|cart|winkelmand|product-category\/patterns\/paid)/i;
  const filteredLinks = [...uniqueByUrl.values()].filter((link) => {
    const haystack = `${link.title} ${link.url}`;
    if (negativeKeyword.test(haystack)) return false;
    return positiveKeyword.test(haystack);
  });

  const links = (filteredLinks.length > 0 ? filteredLinks : [...uniqueByUrl.values()]).slice(
    0,
    30
  );

  return {
    fileName,
    sourceName,
    sourceDescription,
    sourceWebsite,
    language,
    links,
  };
}

function buildArticleMarkdown(source: ParsedSource): string {
  const lines: string[] = [];
  lines.push(
    `## ${source.sourceName}`,
    "",
    source.sourceDescription
      ? source.sourceDescription
      : "Verzamelde links naar gratis (of deels gratis) haakpatronen.",
    ""
  );

  if (source.sourceWebsite) {
    lines.push(`Bronwebsite: ${source.sourceWebsite}`, "");
  }

  if (source.language) {
    lines.push(`Taal volgens bron: ${source.language}`, "");
  }

  lines.push("### Patroonlinks", "");
  for (const link of source.links) {
    lines.push(`- [${link.title}](${link.url})`);
  }
  lines.push("");
  lines.push(
    "_Opmerking: controleer altijd de voorwaarden op de bronwebsite (gratis, betaald, of gemengd)._" 
  );

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (args.apply && !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (required when using --apply)"
    );
  }

  const files = (await readdir(args.dirPath))
    .filter((name) => name.toLowerCase().endsWith(".html"))
    .sort((a, b) => a.localeCompare(b));

  const targetFiles = args.limit ? files.slice(0, args.limit) : files;
  const parsedSources: ParsedSource[] = [];

  for (const fileName of targetFiles) {
    const filePath = path.join(args.dirPath, fileName);
    const html = await readFile(filePath, "utf8");
    const parsed = parseSourceHtml(fileName, html);
    if (parsed.links.length > 0) {
      parsedSources.push(parsed);
    }
  }

  // Dry-run preview
  if (!args.apply) {
    console.log(
      JSON.stringify(
        parsedSources.map((source) => ({
          file: source.fileName,
          source: source.sourceName,
          links: source.links.length,
          sample: source.links.slice(0, 3),
        })),
        null,
        2
      )
    );
    console.log("\nDry run complete. Use --apply to upsert into Supabase.");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey!);
  const { data: domainsData } = await supabase
    .from("domains")
    .select("id,slug,name")
    .eq("is_active", true);

  const domains = (domainsData ?? []) as DomainRow[];
  const domainsBySlug = new Map(domains.map((domain) => [domain.slug, domain]));
  const fallbackDomainId = args.fallbackDomainSlug
    ? (domainsBySlug.get(args.fallbackDomainSlug)?.id ?? null)
    : null;

  let upserted = 0;
  for (const source of parsedSources) {
    const slug = toSlug(`gratis-haakpatronen-${source.sourceName}`);
    const title = `Gratis haakpatronen: ${source.sourceName}`;
    const excerpt =
      source.sourceDescription ??
      "Geselecteerde links naar gratis Nederlandstalige haakpatronen.";
    const bodyMarkdown = buildArticleMarkdown(source);
    const readingTime = estimateReadingTime(bodyMarkdown);

    const payload = {
      slug,
      title,
      excerpt,
      body_markdown: bodyMarkdown,
      article_type: "pattern",
      reading_time_minutes: readingTime,
      is_published: true,
      published_at: new Date().toISOString(),
      domain_id: fallbackDomainId,
      featured_image_url: null,
      seo_title: title,
      seo_description: excerpt.slice(0, 155),
    };

    const { error } = await supabase
      .from("articles")
      .upsert(payload, { onConflict: "slug" });

    if (error) {
      throw new Error(`Failed to upsert ${source.sourceName}: ${error.message}`);
    }
    upserted += 1;
  }

  console.log(`Imported ${upserted} article(s) into articles table.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
