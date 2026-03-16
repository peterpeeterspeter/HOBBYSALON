import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

type Args = {
  filePath: string;
  apply: boolean;
  limit: number | null;
  offset: number;
  authorCreatorId: string | null;
  defaultArticleType: string;
  includeDrafts: boolean;
  fallbackDomainSlug: string | null;
};

type DomainRow = {
  id: string;
  slug: string;
  name: string;
};

type ParsedItem = {
  title: string;
  slug: string;
  excerpt: string | null;
  bodyMarkdown: string;
  featuredImageUrl: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  wordpressStatus: string;
  categories: string[];
  categorySlugs: string[];
  readingTimeMinutes: number;
};

type ImportCandidate = ParsedItem & {
  domainIds: string[];
  primaryDomainId: string | null;
};

const ALLOWED_ARTICLE_TYPES = new Set([
  "tutorial",
  "guide",
  "inspiration",
  "interview",
  "pattern",
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function parseArgs(argv: string[]): Args {
  const args: Args = {
    filePath: path.resolve(process.cwd(), "data/import/wordpress-export.xml"),
    apply: false,
    limit: null,
    offset: 0,
    authorCreatorId: null,
    defaultArticleType: "guide",
    includeDrafts: false,
    fallbackDomainSlug: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--apply") {
      args.apply = true;
      continue;
    }

    if (arg === "--include-drafts") {
      args.includeDrafts = true;
      continue;
    }

    if (arg === "--file" && argv[i + 1]) {
      args.filePath = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--limit" && argv[i + 1]) {
      args.limit = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg === "--offset" && argv[i + 1]) {
      args.offset = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg === "--author-creator-id" && argv[i + 1]) {
      args.authorCreatorId = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--article-type" && argv[i + 1]) {
      args.defaultArticleType = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--fallback-domain-slug" && argv[i + 1]) {
      args.fallbackDomainSlug = argv[i + 1].trim().toLowerCase();
      i += 1;
      continue;
    }
  }

  if (!ALLOWED_ARTICLE_TYPES.has(args.defaultArticleType)) {
    throw new Error(
      `Invalid --article-type '${args.defaultArticleType}'. Allowed: ${Array.from(ALLOWED_ARTICLE_TYPES).join(", ")}`
    );
  }

  if (Number.isNaN(args.limit as number)) {
    throw new Error("Invalid --limit value.");
  }

  if (Number.isNaN(args.offset) || args.offset < 0) {
    throw new Error("Invalid --offset value.");
  }

  return args;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code: string) => {
      const numericCode = Number.parseInt(code, 10);
      return Number.isNaN(numericCode) ? "" : String.fromCodePoint(numericCode);
    })
    .replace(/&#x([\da-fA-F]+);/g, (_, hex: string) => {
      const numericCode = Number.parseInt(hex, 16);
      return Number.isNaN(numericCode) ? "" : String.fromCodePoint(numericCode);
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-");
}

function cleanupXmlValue(raw: string | null): string {
  if (!raw) return "";
  return decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function toSlug(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);

  return normalized || `artikel-${Date.now()}`;
}

function estimateReadingTimeMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function htmlToMarkdownish(html: string): string {
  let out = html;

  out = out
    .replace(/<!--\s*wp:[\s\S]*?-->/g, "")
    .replace(/<!--\s*\/wp:[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|section|article|h[1-6])\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\s*\/\s*li\s*>/gi, "")
    .replace(/<\s*img\s+[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, (_, src: string, alt: string) => `\n\n![${decodeEntities(alt)}](${src})\n\n`)
    .replace(/<\s*img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, (_, src: string) => `\n\n![](${src})\n\n`)
    .replace(/<\s*a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\s*\/\s*a\s*>/gi, (_, href: string, anchorText: string) => {
      const text = stripTags(anchorText).trim();
      return text ? `[${decodeEntities(text)}](${href})` : href;
    });

  out = decodeEntities(stripTags(out));

  out = out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return out;
}

function extractFirstImageFromHtml(html: string): string | null {
  const regex = /<\s*img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const candidate = decodeEntities(match[1] ?? "").trim();
    if (!(candidate.startsWith("http://") || candidate.startsWith("https://"))) continue;
    if (candidate.includes("/elementor/assets/images/placeholder")) continue;
    return candidate;
  }
  return null;
}

function extractFirstImageFromMarkdown(markdown: string): string | null {
  const regex = /!\[[^\]]*\]\(([^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const candidate = (match[1] ?? "").trim();
    if (!(candidate.startsWith("http://") || candidate.startsWith("https://"))) continue;
    if (candidate.includes("/elementor/assets/images/placeholder")) continue;
    return candidate;
  }
  return null;
}

function extractTagValue(xml: string, tagName: string): string {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\/${escapedTag}>`, "i"));
  return cleanupXmlValue(match?.[1] ?? null);
}

function parseDate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed.replace(" ", "T")}Z`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseCategories(itemXml: string): { labels: string[]; slugs: string[] } {
  const labels: string[] = [];
  const slugs: string[] = [];
  const categoryRegex = /<category\s+([^>]*)>([\s\S]*?)<\/category>/gi;
  const acceptedDomains = new Set(["category", "hs_thema", "hs_techniek", "family"]);

  let match: RegExpExecArray | null;
  while ((match = categoryRegex.exec(itemXml)) !== null) {
    const attrs = match[1] ?? "";
    const domainMatch = attrs.match(/domain=["']([^"']+)["']/i);
    if (!domainMatch || !acceptedDomains.has(domainMatch[1])) continue;

    const nicenameMatch = attrs.match(/nicename=["']([^"']+)["']/i);
    const nicename = cleanupXmlValue(nicenameMatch?.[1] ?? null);
    const label = cleanupXmlValue(match[2]);

    if (label) labels.push(label);
    if (nicename) slugs.push(nicename);
  }

  return {
    labels: Array.from(new Set(labels)),
    slugs: Array.from(new Set(slugs)),
  };
}

function mapCategoriesToDomainIds(
  categories: string[],
  categorySlugs: string[],
  domainsBySlug: Map<string, DomainRow>
): string[] {
  const ids: string[] = [];
  const combined = [...categorySlugs, ...categories].map((item) => normalizeText(item));

  const keywordToDomain: Array<[RegExp, string]> = [
    [/(haak|haken|crochet|amigurumi)/, "crochet"],
    [/(brei|breien|knit|knitting|wol)/, "knitting"],
    [/(kaart|kaartjes|card|stempel|stempelen)/, "card-making"],
    [/(naai|naaien|sew|sewing|stof)/, "sewing"],
    [/(sierad|juweel|jewel|bead|kraal)/, "jewelry-making"],
    [/(scrap|scrapbooking|papier|papierwerk)/, "scrapbooking"],
    [/(klei|keramiek|pottery|boetser)/, "pottery"],
    [/(diy|knutsel|craft|hobby|handmade)/, "diy"],
  ];

  for (const token of combined) {
    const direct = domainsBySlug.get(token);
    if (direct && !ids.includes(direct.id)) {
      ids.push(direct.id);
      continue;
    }

    for (const [pattern, slug] of keywordToDomain) {
      if (!pattern.test(token)) continue;
      const mapped = domainsBySlug.get(slug);
      if (mapped && !ids.includes(mapped.id)) {
        ids.push(mapped.id);
      }
      break;
    }
  }

  return ids;
}

function extractItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1] ?? "";
    const postType = extractTagValue(itemXml, "wp:post_type");
    if (postType !== "post") continue;

    const status = extractTagValue(itemXml, "wp:status") || "publish";
    const isPublished = status === "publish";

    const title = extractTagValue(itemXml, "title") || "Zonder titel";
    const slugRaw = extractTagValue(itemXml, "wp:post_name");
    const slug = toSlug(slugRaw || title);

    const excerpt = extractTagValue(itemXml, "excerpt:encoded") || null;
    const htmlContent = extractTagValue(itemXml, "content:encoded");
    const cleanedBody = htmlToMarkdownish(htmlContent);
    const bodyMarkdown = cleanedBody === "null" ? "" : cleanedBody;
    const featuredImageUrl =
      extractFirstImageFromHtml(htmlContent) ??
      extractFirstImageFromMarkdown(bodyMarkdown);

    const categories = parseCategories(itemXml);

    const publishedAt =
      parseDate(extractTagValue(itemXml, "wp:post_date_gmt")) ||
      parseDate(extractTagValue(itemXml, "wp:post_date")) ||
      parseDate(extractTagValue(itemXml, "pubDate"));

    const fallbackExcerpt = bodyMarkdown.slice(0, 220).trim();
    const finalExcerpt = (excerpt && excerpt.slice(0, 280)) || fallbackExcerpt || null;
    const seoDescription = finalExcerpt ? finalExcerpt.slice(0, 160) : null;

    items.push({
      title,
      slug,
      excerpt: finalExcerpt,
      bodyMarkdown,
      featuredImageUrl,
      seoDescription,
      publishedAt,
      isPublished,
      wordpressStatus: status,
      categories: categories.labels,
      categorySlugs: categories.slugs,
      readingTimeMinutes: estimateReadingTimeMinutes(bodyMarkdown),
    });
  }

  return items;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const xml = await readFile(args.filePath, "utf8");
  const parsedItems = extractItems(xml);

  const statusFiltered = parsedItems.filter((item) =>
    args.includeDrafts ? true : item.isPublished
  );

  const dedupedBySlug = new Map<string, ParsedItem>();
  for (const item of statusFiltered) {
    if (!dedupedBySlug.has(item.slug)) {
      dedupedBySlug.set(item.slug, item);
      continue;
    }

    const existing = dedupedBySlug.get(item.slug)!;
    const existingPublished = existing.isPublished ? 1 : 0;
    const incomingPublished = item.isPublished ? 1 : 0;
    if (incomingPublished > existingPublished) {
      dedupedBySlug.set(item.slug, item);
    }
  }

  let candidates = Array.from(dedupedBySlug.values()).sort((a, b) => {
    const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bDate - aDate;
  });

  if (args.offset > 0) {
    candidates = candidates.slice(args.offset);
  }

  if (args.limit !== null) {
    candidates = candidates.slice(0, args.limit);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const writeKey = serviceKey ?? anonKey ?? null;

  const domainsBySlug = new Map<string, DomainRow>();

  if (supabaseUrl && writeKey) {
    const supabase = createClient(supabaseUrl, writeKey);
    const { data: domains, error: domainError } = await supabase
      .from("domains")
      .select("id,slug,name")
      .eq("is_active", true);

    if (domainError) {
      throw new Error(`Failed to load domains: ${domainError.message}`);
    }

    for (const row of (domains ?? []) as DomainRow[]) {
      domainsBySlug.set(normalizeText(row.slug), row);
    }
  }

  const prepared: ImportCandidate[] = candidates.map((item) => {
    const domainIds = mapCategoriesToDomainIds(item.categories, item.categorySlugs, domainsBySlug);
    if (domainIds.length === 0 && args.fallbackDomainSlug) {
      const fallbackDomain = domainsBySlug.get(normalizeText(args.fallbackDomainSlug));
      if (fallbackDomain) {
        domainIds.push(fallbackDomain.id);
      }
    }
    return {
      ...item,
      domainIds,
      primaryDomainId: domainIds[0] ?? null,
    };
  });

  console.log(`Parsed posts: ${parsedItems.length}`);
  console.log(`After status filter: ${statusFiltered.length}`);
  console.log(`After dedupe: ${dedupedBySlug.size}`);
  console.log(`Selected for this run: ${prepared.length}`);

  const withDomain = prepared.filter((item) => item.primaryDomainId).length;
  console.log(`Domain mapped: ${withDomain}/${prepared.length}`);

  if (prepared.length > 0) {
    const preview = prepared.slice(0, 3).map((item) => ({
      slug: item.slug,
      title: item.title,
      status: item.wordpressStatus,
      isPublished: item.isPublished,
      primaryDomainId: item.primaryDomainId,
      featuredImageUrl: item.featuredImageUrl,
      categories: item.categories,
      bodyPreview: item.bodyMarkdown.slice(0, 180),
    }));

    console.log("Preview:");
    console.log(JSON.stringify(preview, null, 2));
  }

  if (!args.apply) {
    console.log("Dry-run complete. Use --apply to write to database.");
    return;
  }

  if (!supabaseUrl || !writeKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and key. Set SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY for --apply mode."
    );
  }

  if (!serviceKey) {
    console.warn(
      "Warning: SUPABASE_SERVICE_ROLE_KEY not set. Falling back to anon key; writes may fail due to RLS."
    );
  }

  const supabase = createClient(supabaseUrl, writeKey);

  let imported = 0;
  let errors = 0;

  for (const item of prepared) {
    const articleRow = {
      slug: item.slug,
      title: item.title,
      excerpt: item.excerpt,
      body_markdown: item.bodyMarkdown,
      featured_image_url: item.featuredImageUrl ?? undefined,
      article_type: args.defaultArticleType,
      reading_time_minutes: item.readingTimeMinutes,
      published_at: item.isPublished ? item.publishedAt ?? new Date().toISOString() : null,
      is_published: item.isPublished,
      is_featured: false,
      author_creator_id: args.authorCreatorId,
      domain_id: item.primaryDomainId,
      seo_title: `${item.title} | Hobbysalon`,
      seo_description: item.seoDescription,
    };

    const { data: upserted, error: upsertError } = await supabase
      .from("articles")
      .upsert(articleRow, { onConflict: "slug" })
      .select("id,slug")
      .single();

    if (upsertError || !upserted?.id) {
      errors += 1;
      console.error(`x ${item.slug}: ${upsertError?.message ?? "Unknown upsert error"}`);
      continue;
    }

    if (item.domainIds.length > 0) {
      const domainRows = item.domainIds.map((domainId) => ({
        article_id: upserted.id,
        domain_id: domainId,
      }));

      const { error: domainsError } = await supabase
        .from("article_domains")
        .upsert(domainRows, { onConflict: "article_id,domain_id" });

      if (domainsError) {
        console.error(`! ${item.slug}: article_domains failed: ${domainsError.message}`);
      }
    }

    imported += 1;
    console.log(`+ ${upserted.slug}`);
  }

  console.log(`Import complete. Imported/updated: ${imported}, errors: ${errors}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
