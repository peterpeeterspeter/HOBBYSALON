"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import {
  cancelCreatorOrder,
  completeCreatorOrder,
} from "@/lib/commerce/medusa/creator-orders";
import {
  createCreatorMarketplaceProduct,
  deleteCreatorMarketplaceProduct,
  updateCreatorMarketplaceProduct,
} from "@/lib/commerce/medusa/creator-products";

const PRODUCT_TYPES = new Set([
  "supply",
  "handmade",
  "event_listing",
  "event_ticket",
  "workshop_ticket",
  "workshop_kit",
]);
const PRODUCT_CONDITION_TYPES = new Set([
  "new",
  "handmade",
  "made_to_order",
  "used",
]);
const PRODUCT_STOCK_MODES = new Set(["in_stock", "made_to_order"]);

const WORKSHOP_FORMATS = new Set(["physical", "online", "hybrid"]);
const WORKSHOP_DIFFICULTY = new Set(["beginner", "intermediate", "advanced"]);
const WORKSHOP_BOOKING_MODES = new Set(["request", "external_link", "internal_booking"]);
const EVENT_TYPES = new Set([
  "handmade_market",
  "hobby_fair",
  "pop_up",
  "open_atelier",
  "workshop_day",
]);
const EVENT_TICKETING_MODES = new Set(["none", "external_link", "internal_ticket"]);
const BOOKING_REQUEST_STATUSES = new Set([
  "new",
  "contacted",
  "confirmed",
  "cancelled",
]);
const ENTITY_LINK_TARGET_TYPES = new Set([
  "product",
  "workshop",
  "event",
  "article",
]);
const ARTICLE_TYPES = new Set([
  "tutorial",
  "inspiration",
  "guide",
  "news",
]);

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function parseOptionalString(
  formData: FormData,
  field: string
): string | null {
  const raw = formData.get(field)?.toString().trim();
  return raw ? raw : null;
}

function parseRequiredString(formData: FormData, field: string): string {
  const raw = formData.get(field)?.toString().trim();
  if (!raw) {
    throw new Error(`${field} is verplicht`);
  }
  return raw;
}

function parseOptionalInt(formData: FormData, field: string): number | null {
  const raw = formData.get(field)?.toString().trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNonNegativeInt(formData: FormData, field: string): number | null {
  const raw = formData.get(field)?.toString().trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${field} is ongeldig.`);
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalUuid(formData: FormData, field: string): string | null {
  const raw = formData.get(field)?.toString().trim();
  if (!raw) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    throw new Error(`${field} is ongeldig.`);
  }
  return raw;
}

function parseOptionalCurrencyCode(formData: FormData, field: string): string | null {
  const raw = formData.get(field)?.toString().trim().toUpperCase();
  if (!raw) return null;
  if (!/^[A-Z]{3}$/.test(raw)) {
    throw new Error(`${field} is ongeldig.`);
  }
  return raw;
}

function parseUuidValues(formData: FormData, field: string): string[] {
  return Array.from(
    new Set(
      (formData.getAll(field) ?? [])
        .map((value) => value.toString().trim())
        .filter((value) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value
          )
        )
    )
  );
}

function parseRequiredUuid(formData: FormData, field: string): string {
  const value = parseRequiredString(formData, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${field} is ongeldig.`);
  }
  return value;
}

function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function getRequiredCreator() {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Je bent niet ingelogd.");
  }

  const creator = await getCreatorByUserId(user.id);
  if (!creator) {
    throw new Error("Maak eerst een creator-profiel aan.");
  }

  const supabase = createPlatformClient();
  const { data: sellerLink, error: sellerLinkError } = await supabase
    .from("user_seller_links")
    .select("seller_id")
    .eq("user_id", user.id)
    .eq("seller_type", "creator")
    .maybeSingle();

  if (sellerLinkError) {
    throw new Error("Kon creator-seller koppeling niet ophalen.");
  }

  if (!sellerLink?.seller_id) {
    throw new Error(
      "Creator seller ontbreekt. Herregistreer via /register/creator."
    );
  }

  return { user, creator, sellerId: sellerLink.seller_id as string };
}

async function ensureUniqueSlug(
  table: "creators" | "products" | "workshops" | "events" | "articles",
  preferredSlug: string,
  ignoreId?: string
): Promise<string> {
  const supabase = createPlatformClient();
  const base = toSlug(preferredSlug) || `item-${Date.now()}`;

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    let query = supabase
      .from(table)
      .select("id")
      .eq("slug", candidate)
      .limit(1);

    if (ignoreId) {
      query = query.neq("id", ignoreId);
    }

    const { data } = await query;
    if (!data || data.length === 0) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

async function syncCreatorDomains(
  creatorId: string,
  domainIds: string[]
): Promise<string | null> {
  const supabase = createPlatformClient();
  const { error: deleteError } = await supabase
    .from("creator_domains")
    .delete()
    .eq("creator_id", creatorId);

  if (deleteError) {
    return deleteError.message;
  }

  if (domainIds.length === 0) {
    return null;
  }

  const rows = domainIds.map((domainId) => ({
    creator_id: creatorId,
    domain_id: domainId,
  }));
  const { error: insertError } = await supabase
    .from("creator_domains")
    .insert(rows);

  if (insertError) {
    return insertError.message;
  }

  return null;
}

async function creatorOwnsEntityTarget(
  creatorId: string,
  targetType: string,
  targetId: string
): Promise<boolean> {
  const supabase = createPlatformClient();

  if (targetType === "product") {
    const { count } = await supabase
      .from("products")
      .select("id", { head: true, count: "exact" })
      .eq("id", targetId)
      .eq("creator_id", creatorId)
      .limit(1);
    return (count ?? 0) > 0;
  }

  if (targetType === "workshop") {
    const { count } = await supabase
      .from("workshops")
      .select("id", { head: true, count: "exact" })
      .eq("id", targetId)
      .eq("creator_id", creatorId)
      .limit(1);
    return (count ?? 0) > 0;
  }

  if (targetType === "article") {
    const { count } = await supabase
      .from("articles")
      .select("id", { head: true, count: "exact" })
      .eq("id", targetId)
      .eq("author_creator_id", creatorId)
      .limit(1);
    return (count ?? 0) > 0;
  }

  if (targetType === "event") {
    const [organizerResult, participantResult] = await Promise.all([
      supabase
        .from("events")
        .select("id", { head: true, count: "exact" })
        .eq("id", targetId)
        .eq("organizer_creator_id", creatorId)
        .limit(1),
      supabase
        .from("event_creators")
        .select("event_id", { head: true, count: "exact" })
        .eq("event_id", targetId)
        .eq("creator_id", creatorId)
        .limit(1),
    ]);
    return (organizerResult.count ?? 0) > 0 || (participantResult.count ?? 0) > 0;
  }

  return false;
}

type SuggestionCandidate = {
  targetType: "product" | "workshop" | "event";
  targetId: string;
  title: string;
  domainId: string | null;
};

function tokenizeForSuggestion(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
    )
  );
}

function scoreSuggestion(
  articleDomainId: string | null,
  articleTokens: string[],
  candidate: SuggestionCandidate
): number {
  const titleTokens = tokenizeForSuggestion(candidate.title);
  let score = 0;

  if (articleDomainId && candidate.domainId && articleDomainId === candidate.domainId) {
    score += 60;
  }

  for (const token of titleTokens) {
    if (articleTokens.includes(token)) {
      score += 20;
    }
  }

  return Math.min(score, 100);
}

async function generateArticleLinkSuggestions(input: {
  creatorId: string;
  articleId: string;
  articleDomainId: string | null;
  sourceText: string;
}): Promise<void> {
  const supabase = createPlatformClient();
  const articleTokens = tokenizeForSuggestion(input.sourceText);
  if (articleTokens.length === 0 && !input.articleDomainId) {
    return;
  }

  const [productsResult, workshopsResult, eventsResult, existingLinksResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("id,title,domain_id")
        .eq("creator_id", input.creatorId)
        .limit(200),
      supabase
        .from("workshops")
        .select("id,title,domain_id")
        .eq("creator_id", input.creatorId)
        .limit(200),
      supabase
        .from("events")
        .select("id,title,domain_id")
        .eq("organizer_creator_id", input.creatorId)
        .limit(200),
      supabase
        .from("entity_links")
        .select("target_entity_type,target_entity_id")
        .eq("source_entity_type", "article")
        .eq("source_entity_id", input.articleId)
        .in("target_entity_type", ["product", "workshop", "event"]),
    ]);

  const existingKeySet = new Set(
    (existingLinksResult.data ?? []).map(
      (row) => `${row.target_entity_type}:${row.target_entity_id}`
    )
  );

  const candidates: SuggestionCandidate[] = [
    ...((productsResult.data ?? []) as Array<{
      id: string;
      title: string | null;
      domain_id: string | null;
    }>).map((row) => ({
      targetType: "product" as const,
      targetId: row.id,
      title: row.title ?? "",
      domainId: row.domain_id,
    })),
    ...((workshopsResult.data ?? []) as Array<{
      id: string;
      title: string | null;
      domain_id: string | null;
    }>).map((row) => ({
      targetType: "workshop" as const,
      targetId: row.id,
      title: row.title ?? "",
      domainId: row.domain_id,
    })),
    ...((eventsResult.data ?? []) as Array<{
      id: string;
      title: string | null;
      domain_id?: string | null;
    }>).map((row) => ({
      targetType: "event" as const,
      targetId: row.id,
      title: row.title ?? "",
      domainId: row.domain_id ?? null,
    })),
  ];

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreSuggestion(input.articleDomainId, articleTokens, candidate),
    }))
    .filter(
      (row) =>
        row.score >= 40 &&
        !existingKeySet.has(`${row.candidate.targetType}:${row.candidate.targetId}`)
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (scored.length === 0) {
    return;
  }

  const rows = scored.map(({ candidate, score }, index) => ({
    source_entity_type: "article",
    source_entity_id: input.articleId,
    target_entity_type: candidate.targetType,
    target_entity_id: candidate.targetId,
    relation_type: "suggested_auto",
    weight: Math.max(1, Math.min(score, 100)),
    sort_order: index + 1,
  }));

  await supabase.from("entity_links").insert(rows);
}

export async function saveCreatorProfileAction(formData: FormData): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      fail("/login?next=/dashboard/creator", "Meld je eerst aan.");
    }

    const displayName = parseRequiredString(formData, "display_name");
    const preferredSlug = parseOptionalString(formData, "slug") ?? displayName;
    const slug = await ensureUniqueSlug("creators", preferredSlug);
    const selectedDomainIds = parseUuidValues(formData, "domain_ids");
    const creatorTypes = (formData.getAll("creator_types") ?? [])
      .map((value) => value.toString())
      .filter(Boolean);

    const payload = {
      user_id: user.id,
      slug,
      display_name: displayName,
      business_name: parseOptionalString(formData, "business_name"),
      bio: parseOptionalString(formData, "bio"),
      avatar_url: parseOptionalString(formData, "avatar_url"),
      banner_url: parseOptionalString(formData, "banner_url"),
      website_url: parseOptionalString(formData, "website_url"),
      instagram_url: parseOptionalString(formData, "instagram_url"),
      facebook_url: parseOptionalString(formData, "facebook_url"),
      city: parseOptionalString(formData, "city"),
      country_code: parseOptionalString(formData, "country_code") ?? "BE",
      creator_types: creatorTypes.length > 0 ? creatorTypes : ["maker"],
    };

    const existing = await getCreatorByUserId(user.id);
    const supabase = createPlatformClient();

    let finalCreatorSlug = payload.slug;

    if (existing) {
      const slugForUpdate =
        preferredSlug && preferredSlug !== existing.slug
          ? await ensureUniqueSlug("creators", preferredSlug, existing.id)
          : existing.slug;
      finalCreatorSlug = slugForUpdate;

      const { error } = await supabase
        .from("creators")
        .update({ ...payload, slug: slugForUpdate })
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (error) {
        fail("/dashboard/creator", "Opslaan van creator-profiel mislukt.");
      }

      const domainSyncError = await syncCreatorDomains(existing.id, selectedDomainIds);
      if (domainSyncError) {
        fail("/dashboard/creator", "Opslaan van hobby-domeinen mislukt.");
      }
    } else {
      const { data: insertedRows, error } = await supabase
        .from("creators")
        .insert(payload)
        .select("id")
        .limit(1);
      if (error || !insertedRows?.[0]?.id) {
        fail("/dashboard/creator", "Aanmaken van creator-profiel mislukt.");
      }

      const domainSyncError = await syncCreatorDomains(
        insertedRows[0].id as string,
        selectedDomainIds
      );
      if (domainSyncError) {
        fail("/dashboard/creator", "Opslaan van hobby-domeinen mislukt.");
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/creator");
    revalidatePath("/creators");
    revalidatePath(`/creator/${finalCreatorSlug}`);
    ok("/dashboard/creator", "Creator-profiel opgeslagen.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createCreatorEntityLinkAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const targetType = parseRequiredString(formData, "target_entity_type");
    const targetId = parseRequiredUuid(formData, "target_entity_id");
    const relationType = parseRequiredString(formData, "relation_type").toLowerCase();
    const weight = parseOptionalInt(formData, "weight") ?? 1;
    const sortOrder = parseOptionalInt(formData, "sort_order");

    if (!ENTITY_LINK_TARGET_TYPES.has(targetType)) {
      fail("/dashboard/creator", "Ongeldig target type.");
    }

    const creatorOwnsTarget = await creatorOwnsEntityTarget(
      creator.id,
      targetType,
      targetId
    );
    if (!creatorOwnsTarget) {
      fail(
        "/dashboard/creator",
        "Je kan alleen linken naar je eigen producten, workshops, events of artikels."
      );
    }

    const supabase = createPlatformClient();
    const { data: existingRows } = await supabase
      .from("entity_links")
      .select("id")
      .eq("source_entity_type", "creator")
      .eq("source_entity_id", creator.id)
      .eq("target_entity_type", targetType)
      .eq("target_entity_id", targetId)
      .eq("relation_type", relationType)
      .limit(1);

    if (existingRows && existingRows.length > 0) {
      fail("/dashboard/creator", "Deze link bestaat al.");
    }

    const { error } = await supabase.from("entity_links").insert({
      source_entity_type: "creator",
      source_entity_id: creator.id,
      target_entity_type: targetType,
      target_entity_id: targetId,
      relation_type: relationType,
      weight: Math.max(1, Math.min(100, weight)),
      sort_order: sortOrder,
    });

    if (error) {
      fail("/dashboard/creator", "Aanmaken van entity link mislukt.");
    }

    revalidatePath("/dashboard/creator");
    revalidatePath(`/creator/${creator.slug}`);
    ok("/dashboard/creator", "Entity link toegevoegd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteCreatorEntityLinkAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const entityLinkId = parseRequiredUuid(formData, "entity_link_id");
    const supabase = createPlatformClient();
    const { error } = await supabase
      .from("entity_links")
      .delete()
      .eq("id", entityLinkId)
      .eq("source_entity_type", "creator")
      .eq("source_entity_id", creator.id);

    if (error) {
      fail("/dashboard/creator", "Verwijderen van entity link mislukt.");
    }

    revalidatePath("/dashboard/creator");
    revalidatePath(`/creator/${creator.slug}`);
    ok("/dashboard/creator", "Entity link verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createArticleAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const title = parseRequiredString(formData, "title");
    const articleType = parseRequiredString(formData, "article_type");
    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("articles", preferredSlug);
    const excerpt = parseOptionalString(formData, "excerpt");
    const bodyMarkdown = parseOptionalString(formData, "body_markdown");
    const domainId = parseOptionalUuid(formData, "domain_id");

    if (!ARTICLE_TYPES.has(articleType)) {
      fail("/dashboard/creator", "Ongeldig artikeltype.");
    }

    const supabase = createPlatformClient();
    const { data: article, error } = await supabase
      .from("articles")
      .insert({
        slug,
        title,
        excerpt,
        body_markdown: bodyMarkdown,
        article_type: articleType,
        author_creator_id: creator.id,
        domain_id: domainId,
        is_published: !!formData.get("is_published"),
        published_at: formData.get("is_published") ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (error || !article?.id) {
      fail("/dashboard/creator", "Aanmaken van artikel mislukt.");
    }

    await generateArticleLinkSuggestions({
      creatorId: creator.id,
      articleId: article.id,
      articleDomainId: domainId,
      sourceText: [title, excerpt ?? "", bodyMarkdown ?? ""].join(" "),
    });

    revalidatePath("/dashboard/creator");
    ok("/dashboard/creator", "Artikel opgeslagen met link-suggesties.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function updateArticleAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const articleId = parseRequiredUuid(formData, "id");
    const title = parseRequiredString(formData, "title");
    const articleType = parseRequiredString(formData, "article_type");
    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("articles", preferredSlug, articleId);
    const excerpt = parseOptionalString(formData, "excerpt");
    const bodyMarkdown = parseOptionalString(formData, "body_markdown");
    const domainId = parseOptionalUuid(formData, "domain_id");

    if (!ARTICLE_TYPES.has(articleType)) {
      fail("/dashboard/creator", "Ongeldig artikeltype.");
    }

    const supabase = createPlatformClient();
    const { error } = await supabase
      .from("articles")
      .update({
        slug,
        title,
        excerpt,
        body_markdown: bodyMarkdown,
        article_type: articleType,
        domain_id: domainId,
        is_published: !!formData.get("is_published"),
        published_at: formData.get("is_published") ? new Date().toISOString() : null,
      })
      .eq("id", articleId)
      .eq("author_creator_id", creator.id);

    if (error) {
      fail("/dashboard/creator", "Bijwerken van artikel mislukt.");
    }

    await supabase
      .from("entity_links")
      .delete()
      .eq("source_entity_type", "article")
      .eq("source_entity_id", articleId)
      .eq("relation_type", "suggested_auto");

    await generateArticleLinkSuggestions({
      creatorId: creator.id,
      articleId,
      articleDomainId: domainId,
      sourceText: [title, excerpt ?? "", bodyMarkdown ?? ""].join(" "),
    });

    revalidatePath("/dashboard/creator");
    ok("/dashboard/creator", "Artikel bijgewerkt. Suggesties vernieuwd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function approveArticleSuggestionAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const entityLinkId = parseRequiredUuid(formData, "entity_link_id");
    const relationType = parseOptionalString(formData, "relation_type") ?? "related";
    const supabase = createPlatformClient();

    const { data: linkRow, error: linkError } = await supabase
      .from("entity_links")
      .select("id,source_entity_id,relation_type")
      .eq("id", entityLinkId)
      .eq("source_entity_type", "article")
      .eq("relation_type", "suggested_auto")
      .maybeSingle();

    if (linkError || !linkRow) {
      fail("/dashboard/creator", "Suggestie niet gevonden.");
    }

    const { data: articleRow } = await supabase
      .from("articles")
      .select("id")
      .eq("id", linkRow.source_entity_id)
      .eq("author_creator_id", creator.id)
      .maybeSingle();

    if (!articleRow?.id) {
      fail("/dashboard/creator", "Geen rechten op deze suggestie.");
    }

    const { error } = await supabase
      .from("entity_links")
      .update({
        relation_type: relationType,
      })
      .eq("id", entityLinkId);

    if (error) {
      fail("/dashboard/creator", "Bevestigen van suggestie mislukt.");
    }

    revalidatePath("/dashboard/creator");
    ok("/dashboard/creator", "Suggestie bevestigd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function dismissArticleSuggestionAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const entityLinkId = parseRequiredUuid(formData, "entity_link_id");
    const supabase = createPlatformClient();

    const { data: linkRow, error: linkError } = await supabase
      .from("entity_links")
      .select("id,source_entity_id")
      .eq("id", entityLinkId)
      .eq("source_entity_type", "article")
      .eq("relation_type", "suggested_auto")
      .maybeSingle();

    if (linkError || !linkRow) {
      fail("/dashboard/creator", "Suggestie niet gevonden.");
    }

    const { data: articleRow } = await supabase
      .from("articles")
      .select("id")
      .eq("id", linkRow.source_entity_id)
      .eq("author_creator_id", creator.id)
      .maybeSingle();

    if (!articleRow?.id) {
      fail("/dashboard/creator", "Geen rechten op deze suggestie.");
    }

    const { error } = await supabase
      .from("entity_links")
      .delete()
      .eq("id", entityLinkId);

    if (error) {
      fail("/dashboard/creator", "Verwijderen van suggestie mislukt.");
    }

    revalidatePath("/dashboard/creator");
    ok("/dashboard/creator", "Suggestie verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProductAction(formData: FormData): Promise<void> {
  try {
    const { creator, sellerId } = await getRequiredCreator();
    const title = parseRequiredString(formData, "title");
    const productType = parseRequiredString(formData, "product_type");
    const stockMode = parseRequiredString(formData, "stock_mode");
    const priceCents = parseOptionalNonNegativeInt(formData, "price_cents");
    const currencyCode = parseOptionalCurrencyCode(formData, "currency_code") ?? "EUR";
    const conditionType = parseOptionalString(formData, "condition_type");
    const estimatedDispatchDays = parseOptionalNonNegativeInt(
      formData,
      "estimated_dispatch_days"
    );
    const personalizationAvailable = !!formData.get("personalization_available");
    const domainId = parseOptionalUuid(formData, "domain_id");
    const categoryId = parseOptionalUuid(formData, "category_id");

    if (!PRODUCT_TYPES.has(productType)) {
      fail("/dashboard/products", "Ongeldig producttype.");
    }

    if (productType !== "handmade") {
      fail(
        "/dashboard/products",
        "Voor creator P2P-producten is momenteel enkel type 'handmade' toegestaan."
      );
    }
    if (!PRODUCT_STOCK_MODES.has(stockMode)) {
      fail("/dashboard/products", "Ongeldige voorraadmodus.");
    }
    if (conditionType && !PRODUCT_CONDITION_TYPES.has(conditionType)) {
      fail("/dashboard/products", "Ongeldige conditie.");
    }
    if (priceCents === null) {
      fail("/dashboard/products", "Prijs (in cent) is verplicht.");
    }

    const result = await createCreatorMarketplaceProduct({
      sellerId,
      platformCreatorId: creator.id,
      title,
      slug: parseOptionalString(formData, "slug"),
      shortDescription: parseOptionalString(formData, "short_description"),
      description: parseOptionalString(formData, "description"),
      featuredImageUrl: parseOptionalString(formData, "featured_image_url"),
      conditionType:
        (conditionType as "new" | "handmade" | "made_to_order" | "used" | null) ??
        null,
      personalizationAvailable,
      estimatedDispatchDays,
      platformDomainId: domainId,
      platformCategoryId: categoryId,
      isActive: !!formData.get("is_active"),
      manageInventory: stockMode === "in_stock",
      allowBackorder: stockMode !== "in_stock",
      priceCents,
      currencyCode,
    });

    if (!result.ok) {
      fail(
        "/dashboard/products",
        result.error ?? "Product aanmaken via Medusa mislukt."
      );
    }

    revalidatePath("/dashboard/products");
    revalidatePath(`/creator/${creator.slug}`);
    ok(
      "/dashboard/products",
      "Product aangemaakt. Het kan enkele seconden duren voor het zichtbaar is."
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/products",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function updateProductAction(formData: FormData): Promise<void> {
  try {
    const { creator, sellerId } = await getRequiredCreator();
    const productId = parseRequiredString(formData, "id");
    const title = parseRequiredString(formData, "title");
    const productType = parseRequiredString(formData, "product_type");
    const stockMode = parseRequiredString(formData, "stock_mode");
    const priceCents = parseOptionalNonNegativeInt(formData, "price_cents");
    const currencyCode = parseOptionalCurrencyCode(formData, "currency_code");
    const conditionType = parseOptionalString(formData, "condition_type");
    const estimatedDispatchDays = parseOptionalNonNegativeInt(
      formData,
      "estimated_dispatch_days"
    );
    const personalizationAvailable = !!formData.get("personalization_available");
    const domainId = parseOptionalUuid(formData, "domain_id");
    const categoryId = parseOptionalUuid(formData, "category_id");

    if (!PRODUCT_TYPES.has(productType)) {
      fail("/dashboard/products", "Ongeldig producttype.");
    }
    if (!PRODUCT_STOCK_MODES.has(stockMode)) {
      fail("/dashboard/products", "Ongeldige voorraadmodus.");
    }
    if (conditionType && !PRODUCT_CONDITION_TYPES.has(conditionType)) {
      fail("/dashboard/products", "Ongeldige conditie.");
    }

    const supabase = createPlatformClient();
    const medusaProductIdFromForm = parseOptionalString(
      formData,
      "medusa_product_id"
    );
    const { data: existingProduct, error: existingError } = await supabase
      .from("products")
      .select("id,medusa_product_id")
      .eq("id", productId)
      .eq("creator_id", creator.id)
      .maybeSingle();

    if (existingError || !existingProduct) {
      fail("/dashboard/products", "Product niet gevonden.");
    }

    const medusaProductId =
      medusaProductIdFromForm || existingProduct.medusa_product_id || null;

    if (medusaProductId) {
      if (productType !== "handmade") {
        fail(
          "/dashboard/products",
          "Medusa creator-producten ondersteunen momenteel enkel type 'handmade'."
        );
      }

      const result = await updateCreatorMarketplaceProduct({
        sellerId,
        medusaProductId,
        platformCreatorId: creator.id,
        title,
        slug: parseOptionalString(formData, "slug"),
        shortDescription: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        featuredImageUrl: parseOptionalString(formData, "featured_image_url"),
        conditionType:
          (conditionType as
            | "new"
            | "handmade"
            | "made_to_order"
            | "used"
            | null) ?? null,
        personalizationAvailable,
        estimatedDispatchDays,
        platformDomainId: domainId,
        platformCategoryId: categoryId,
        isActive: !!formData.get("is_active"),
        manageInventory: stockMode === "in_stock",
        allowBackorder: stockMode !== "in_stock",
        priceCents: priceCents ?? undefined,
        currencyCode: currencyCode ?? undefined,
      });

      if (!result.ok) {
        fail(
          "/dashboard/products",
          result.error ?? "Product bijwerken via Medusa mislukt."
        );
      }

      revalidatePath("/dashboard/products");
      revalidatePath(`/creator/${creator.slug}`);
      ok(
        "/dashboard/products",
        "Product bijgewerkt. Het kan enkele seconden duren voor wijzigingen zichtbaar zijn."
      );
    }

    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("products", preferredSlug, productId);

    const { error } = await supabase
      .from("products")
      .update({
        slug,
        title,
        short_description: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        featured_image_url: parseOptionalString(formData, "featured_image_url"),
        domain_id: domainId,
        category_id: categoryId,
        condition_type: conditionType,
        personalization_available: personalizationAvailable,
        estimated_dispatch_days: estimatedDispatchDays,
        product_type: productType,
        status: formData.get("is_active") ? "active" : "draft",
        is_active: !!formData.get("is_active"),
      })
      .eq("id", productId)
      .eq("creator_id", creator.id);

    if (error) {
      fail("/dashboard/products", "Product bijwerken mislukt.");
    }

    revalidatePath("/dashboard/products");
    revalidatePath(`/creator/${creator.slug}`);
    ok("/dashboard/products", "Product bijgewerkt.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/products",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function unpublishProductAction(formData: FormData): Promise<void> {
  try {
    const { creator, sellerId } = await getRequiredCreator();
    const productId = parseRequiredString(formData, "id");
    const medusaProductId = parseOptionalString(formData, "medusa_product_id");
    const supabase = createPlatformClient();

    if (medusaProductId) {
      const result = await updateCreatorMarketplaceProduct({
        sellerId,
        medusaProductId,
        platformCreatorId: creator.id,
        isActive: false,
      });
      if (!result.ok) {
        fail(
          "/dashboard/products",
          result.error ?? "Product depubliceren via Medusa mislukt."
        );
      }
    }

    const { error } = await supabase
      .from("products")
      .update({
        status: "archived",
        is_active: false,
      })
      .eq("id", productId)
      .eq("creator_id", creator.id);

    if (error) {
      fail("/dashboard/products", "Product depubliceren mislukt.");
    }

    revalidatePath("/dashboard/products");
    revalidatePath(`/creator/${creator.slug}`);
    ok("/dashboard/products", "Product gedeactiveerd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/products",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  try {
    const { creator, sellerId } = await getRequiredCreator();
    const productId = parseRequiredString(formData, "id");
    const medusaProductId = parseOptionalString(formData, "medusa_product_id");
    const supabase = createPlatformClient();

    if (medusaProductId) {
      const result = await deleteCreatorMarketplaceProduct({
        sellerId,
        medusaProductId,
      });
      if (!result.ok) {
        fail(
          "/dashboard/products",
          result.error ?? "Product verwijderen via Medusa mislukt."
        );
      }
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("creator_id", creator.id);

    if (error) {
      fail("/dashboard/products", "Product verwijderen mislukt.");
    }

    revalidatePath("/dashboard/products");
    revalidatePath(`/creator/${creator.slug}`);
    ok("/dashboard/products", "Product verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/products",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function completeCreatorOrderAction(formData: FormData): Promise<void> {
  try {
    const { sellerId } = await getRequiredCreator();
    const orderId = parseRequiredString(formData, "order_id");
    const result = await completeCreatorOrder(sellerId, orderId);
    if (!result.ok) {
      fail("/dashboard/orders", result.error ?? "Order afronden mislukt.");
    }

    revalidatePath("/dashboard/orders");
    ok("/dashboard/orders", "Order gemarkeerd als voltooid.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/orders",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function cancelCreatorOrderAction(formData: FormData): Promise<void> {
  try {
    const { sellerId } = await getRequiredCreator();
    const orderId = parseRequiredString(formData, "order_id");
    const result = await cancelCreatorOrder(sellerId, orderId);
    if (!result.ok) {
      fail("/dashboard/orders", result.error ?? "Order annuleren mislukt.");
    }

    revalidatePath("/dashboard/orders");
    ok("/dashboard/orders", "Order geannuleerd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/orders",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createWorkshopAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const title = parseRequiredString(formData, "title");
    const formatType = parseRequiredString(formData, "format_type");
    const difficultyLevel = parseRequiredString(formData, "difficulty_level");
    const bookingMode = parseRequiredString(formData, "booking_mode");

    if (!WORKSHOP_FORMATS.has(formatType)) {
      fail("/dashboard/workshops", "Ongeldige workshopvorm.");
    }
    if (!WORKSHOP_DIFFICULTY.has(difficultyLevel)) {
      fail("/dashboard/workshops", "Ongeldig niveau.");
    }
    if (!WORKSHOP_BOOKING_MODES.has(bookingMode)) {
      fail("/dashboard/workshops", "Ongeldige boekingsmethode.");
    }

    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("workshops", preferredSlug);
    const supabase = createPlatformClient();

    const { error } = await supabase.from("workshops").insert({
      creator_id: creator.id,
      slug,
      title,
      short_description: parseOptionalString(formData, "short_description"),
      description: parseOptionalString(formData, "description"),
      featured_image_url: parseOptionalString(formData, "featured_image_url"),
      format_type: formatType,
      difficulty_level: difficultyLevel,
      booking_mode: bookingMode,
      booking_url: parseOptionalString(formData, "booking_url"),
      city: parseOptionalString(formData, "city"),
      location_name: parseOptionalString(formData, "location_name"),
      duration_minutes: parseOptionalInt(formData, "duration_minutes"),
      capacity: parseOptionalInt(formData, "capacity"),
      price_cents: parseOptionalInt(formData, "price_cents") ?? 0,
      currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
      is_active: !!formData.get("is_active"),
    });

    if (error) {
      fail("/dashboard/workshops", "Workshop aanmaken mislukt.");
    }

    revalidatePath("/dashboard/workshops");
    ok("/dashboard/workshops", "Workshop aangemaakt.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/workshops",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function updateWorkshopAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const workshopId = parseRequiredString(formData, "id");
    const title = parseRequiredString(formData, "title");
    const formatType = parseRequiredString(formData, "format_type");
    const difficultyLevel = parseRequiredString(formData, "difficulty_level");
    const bookingMode = parseRequiredString(formData, "booking_mode");

    if (!WORKSHOP_FORMATS.has(formatType)) {
      fail("/dashboard/workshops", "Ongeldige workshopvorm.");
    }
    if (!WORKSHOP_DIFFICULTY.has(difficultyLevel)) {
      fail("/dashboard/workshops", "Ongeldig niveau.");
    }
    if (!WORKSHOP_BOOKING_MODES.has(bookingMode)) {
      fail("/dashboard/workshops", "Ongeldige boekingsmethode.");
    }

    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("workshops", preferredSlug, workshopId);
    const supabase = createPlatformClient();

    const { error } = await supabase
      .from("workshops")
      .update({
        slug,
        title,
        short_description: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        featured_image_url: parseOptionalString(formData, "featured_image_url"),
        format_type: formatType,
        difficulty_level: difficultyLevel,
        booking_mode: bookingMode,
        booking_url: parseOptionalString(formData, "booking_url"),
        city: parseOptionalString(formData, "city"),
        location_name: parseOptionalString(formData, "location_name"),
        duration_minutes: parseOptionalInt(formData, "duration_minutes"),
        capacity: parseOptionalInt(formData, "capacity"),
        price_cents: parseOptionalInt(formData, "price_cents") ?? 0,
        currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
        is_active: !!formData.get("is_active"),
      })
      .eq("id", workshopId)
      .eq("creator_id", creator.id);

    if (error) {
      fail("/dashboard/workshops", "Workshop bijwerken mislukt.");
    }

    revalidatePath("/dashboard/workshops");
    ok("/dashboard/workshops", "Workshop bijgewerkt.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/workshops",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createEventAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const title = parseRequiredString(formData, "title");
    const eventType = parseRequiredString(formData, "event_type");
    const startsAt = parseRequiredString(formData, "starts_at");
    const endsAt = parseRequiredString(formData, "ends_at");
    const ticketingMode = parseRequiredString(formData, "ticketing_mode");

    if (!EVENT_TYPES.has(eventType)) {
      fail("/dashboard/events", "Ongeldig event type.");
    }
    if (!EVENT_TICKETING_MODES.has(ticketingMode)) {
      fail("/dashboard/events", "Ongeldige ticketmodus.");
    }

    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("events", preferredSlug);
    const supabase = createPlatformClient();

    const { error } = await supabase.from("events").insert({
      slug,
      title,
      short_description: parseOptionalString(formData, "short_description"),
      description: parseOptionalString(formData, "description"),
      event_type: eventType,
      organizer_creator_id: creator.id,
      starts_at: startsAt,
      ends_at: endsAt,
      location_name: parseOptionalString(formData, "location_name"),
      city: parseOptionalString(formData, "city"),
      address_line_1: parseOptionalString(formData, "address_line_1"),
      postal_code: parseOptionalString(formData, "postal_code"),
      country_code: parseOptionalString(formData, "country_code") ?? "BE",
      ticketing_mode: ticketingMode,
      ticket_url: parseOptionalString(formData, "ticket_url"),
      ticket_price_cents: parseOptionalInt(formData, "ticket_price_cents"),
      currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
      featured_image_url: parseOptionalString(formData, "featured_image_url"),
      is_active: !!formData.get("is_active"),
    });

    if (error) {
      fail("/dashboard/events", "Event aanmaken mislukt.");
    }

    revalidatePath("/dashboard/events");
    ok("/dashboard/events", "Event aangemaakt.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/events",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function updateEventAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const eventId = parseRequiredString(formData, "id");
    const title = parseRequiredString(formData, "title");
    const eventType = parseRequiredString(formData, "event_type");
    const startsAt = parseRequiredString(formData, "starts_at");
    const endsAt = parseRequiredString(formData, "ends_at");
    const ticketingMode = parseRequiredString(formData, "ticketing_mode");

    if (!EVENT_TYPES.has(eventType)) {
      fail("/dashboard/events", "Ongeldig event type.");
    }
    if (!EVENT_TICKETING_MODES.has(ticketingMode)) {
      fail("/dashboard/events", "Ongeldige ticketmodus.");
    }

    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("events", preferredSlug, eventId);
    const supabase = createPlatformClient();

    const { error } = await supabase
      .from("events")
      .update({
        slug,
        title,
        short_description: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        event_type: eventType,
        starts_at: startsAt,
        ends_at: endsAt,
        location_name: parseOptionalString(formData, "location_name"),
        city: parseOptionalString(formData, "city"),
        address_line_1: parseOptionalString(formData, "address_line_1"),
        postal_code: parseOptionalString(formData, "postal_code"),
        country_code: parseOptionalString(formData, "country_code") ?? "BE",
        ticketing_mode: ticketingMode,
        ticket_url: parseOptionalString(formData, "ticket_url"),
        ticket_price_cents: parseOptionalInt(formData, "ticket_price_cents"),
        currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
        featured_image_url: parseOptionalString(formData, "featured_image_url"),
        is_active: !!formData.get("is_active"),
      })
      .eq("id", eventId)
      .eq("organizer_creator_id", creator.id);

    if (error) {
      fail("/dashboard/events", "Event bijwerken mislukt.");
    }

    revalidatePath("/dashboard/events");
    ok("/dashboard/events", "Event bijgewerkt.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/events",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function updateBookingRequestStatusAction(
  formData: FormData
): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const requestId = parseRequiredString(formData, "id");
    const status = parseRequiredString(formData, "status");

    if (!BOOKING_REQUEST_STATUSES.has(status)) {
      fail("/dashboard/workshops", "Ongeldige status.");
    }

    const supabase = createPlatformClient();
    const { error } = await supabase
      .from("workshop_booking_requests")
      .update({ status })
      .eq("id", requestId)
      .eq("creator_id", creator.id);

    if (error) {
      fail("/dashboard/workshops", "Status update mislukt.");
    }

    revalidatePath("/dashboard/workshops");
    ok("/dashboard/workshops", "Booking status bijgewerkt.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/workshops",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}
