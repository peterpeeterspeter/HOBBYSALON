"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPlatformClient,
} from "@/lib/platform/client";
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
import { ensureCreatorSellerLinked } from "@/lib/commerce/medusa/creator-onboarding";
import { resolveUploadedOrExistingUrl, requireUploadedImageUrl, resolveProductImageUrl } from "@/lib/storage/upload-image";
import {
  attachDefaultEventPlan,
  enforceCreatorSocialUrls,
  enforceEventTicketingFields,
  enforceHandmadePublishCredits,
  enforceWorkshopBookingFields,
  purchaseSpotlightBoostAction,
} from "@/lib/platform/commercial-enforcement";
import { addCredits } from "@/lib/platform/listing-credits";
import { isAuthorableArticleType } from "@/lib/content/article-types";

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
const WORKSHOP_BOOKING_MODES = new Set(["request", "external_link"]);
const EVENT_TYPES = new Set([
  "handmade_market",
  "hobby_fair",
  "pop_up",
  "open_atelier",
  "workshop_day",
]);
const EVENT_TICKETING_MODES = new Set(["none", "external_link"]);
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
  "project",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID_PATTERN.test(raw)) {
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
        .filter((value) => UUID_PATTERN.test(value))
    )
  );
}

function parseRequiredUuid(formData: FormData, field: string): string {
  const value = parseRequiredString(formData, field);
  if (!UUID_PATTERN.test(value)) {
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
    const ensured = await ensureCreatorSellerLinked(
      user.id,
      user.email ?? "",
      creator
    );

    if (!ensured.ok || !ensured.sellerId) {
      throw new Error(
        ensured.error ??
          "Creator seller ontbreekt. Herregistreer via /register/creator."
      );
    }

    return { user, creator, sellerId: ensured.sellerId };
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

function sanitizeCreatorTypes(values: string[]): string[] {
  const allowed = new Set([
    "maker",
    "workshopgever",
    "supplier",
    "content_creator",
    "organizer",
  ]);
  const normalized = Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => allowed.has(value))
    )
  );
  return normalized.length > 0 ? normalized : ["maker"];
}

async function syncCreatorAccountRoles(
  userId: string,
  creatorTypes: string[],
  supabase: ReturnType<typeof createPlatformClient>
): Promise<string | null> {
  const desiredRoles = new Set<string>(["creator"]);
  if (creatorTypes.includes("workshopgever")) {
    desiredRoles.add("workshop_host");
  }
  if (creatorTypes.includes("organizer")) {
    desiredRoles.add("organizer");
  }

  for (const role of desiredRoles) {
    const { error } = await supabase.from("user_account_roles").upsert(
      {
        user_id: userId,
        role,
      },
      { onConflict: "user_id,role" }
    );
    if (error) {
      return error.message;
    }
  }

  const rolesToRemove: Array<"workshop_host" | "organizer"> = [];
  if (!desiredRoles.has("workshop_host")) {
    rolesToRemove.push("workshop_host");
  }
  if (!desiredRoles.has("organizer")) {
    rolesToRemove.push("organizer");
  }

  if (rolesToRemove.length > 0) {
    const { error } = await supabase
      .from("user_account_roles")
      .delete()
      .eq("user_id", userId)
      .in("role", rolesToRemove);
    if (error) {
      return error.message;
    }
  }

  return null;
}

async function syncCreatorDomains(
  creatorId: string,
  domainIds: string[],
  supabase: ReturnType<typeof createPlatformClient>
): Promise<string | null> {
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

  if (targetType === "project") {
    const { count } = await supabase
      .from("entity_links")
      .select("id", { head: true, count: "exact" })
      .eq("source_entity_type", "creator")
      .eq("source_entity_id", creatorId)
      .eq("target_entity_type", "project")
      .eq("target_entity_id", targetId)
      .limit(1);
    return (count ?? 0) > 0;
  }

  return false;
}

async function getCreatorLinkedProject(
  creatorId: string,
  projectId: string
): Promise<{ id: string; slug: string } | null> {
  const supabase = createPlatformClient();
  const { data: creatorProjectLink } = await supabase
    .from("entity_links")
    .select("id")
    .eq("source_entity_type", "creator")
    .eq("source_entity_id", creatorId)
    .eq("target_entity_type", "project")
    .eq("target_entity_id", projectId)
    .maybeSingle();

  if (!creatorProjectLink?.id) return null;

  const { data: projectRow } = await supabase
    .from("projects")
    .select("id,slug")
    .eq("id", projectId)
    .maybeSingle();

  if (!projectRow?.id || !projectRow.slug) return null;
  return { id: projectRow.id as string, slug: projectRow.slug as string };
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
    const existing = await getCreatorByUserId(user.id);
    const submittedTypes = (formData.getAll("creator_types") ?? [])
      .map((value) => value.toString())
      .filter(Boolean);
    // Roles live on Account; profile form may omit creator_types — keep existing.
    const creatorTypes = sanitizeCreatorTypes(
      submittedTypes.length > 0
        ? submittedTypes
        : (existing?.creator_types ?? ["maker"])
    );
    const avatarUrl = await resolveUploadedOrExistingUrl(
      formData,
      "avatar_file",
      existing?.avatar_url,
      `creators/${user.id}/avatar`
    );
    const bannerUrl = await resolveUploadedOrExistingUrl(
      formData,
      "banner_file",
      existing?.banner_url,
      `creators/${user.id}/banner`
    );

    const socialUrls = await enforceCreatorSocialUrls(
      existing?.id ?? "",
      creatorTypes,
      {
        website_url: parseOptionalString(formData, "website_url"),
        instagram_url: parseOptionalString(formData, "instagram_url"),
        facebook_url: parseOptionalString(formData, "facebook_url"),
      }
    );

    const payload = {
      user_id: user.id,
      slug,
      display_name: displayName,
      business_name: parseOptionalString(formData, "business_name"),
      bio: parseOptionalString(formData, "bio"),
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      website_url: socialUrls.website_url,
      instagram_url: socialUrls.instagram_url,
      facebook_url: socialUrls.facebook_url,
      city: parseOptionalString(formData, "city"),
      country_code: parseOptionalString(formData, "country_code") ?? "BE",
      creator_types: creatorTypes,
    };

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
        console.error("Failed to update creator profile", {
          userId: user.id,
          code: error.code,
          message: error.message,
        });
        fail("/dashboard/creator", "Opslaan van creator-profiel mislukt.");
      }

      const domainSyncError = await syncCreatorDomains(
        existing.id,
        selectedDomainIds,
        supabase
      );
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
        console.error("Failed to create creator profile", {
          userId: user.id,
          code: error?.code,
          message: error?.message,
        });
        fail("/dashboard/creator", "Aanmaken van creator-profiel mislukt.");
      }

      const domainSyncError = await syncCreatorDomains(
        insertedRows[0].id as string,
        selectedDomainIds,
        supabase
      );
      if (domainSyncError) {
        fail("/dashboard/creator", "Opslaan van hobby-domeinen mislukt.");
      }
    }

    const roleSyncError = await syncCreatorAccountRoles(
      user.id,
      creatorTypes,
      supabase
    );
    if (roleSyncError) {
      console.error("Failed to assign creator roles", {
        userId: user.id,
        message: roleSyncError,
      });
      fail("/dashboard/creator", "Creator-rol kon niet worden opgeslagen.");
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/creator");
    revalidatePath("/dashboard/account");
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

export async function updateCreatorTypesAction(formData: FormData): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      fail("/login?next=/dashboard/account", "Meld je eerst aan.");
    }

    const creator = await getCreatorByUserId(user.id);
    if (!creator) {
      fail(
        "/dashboard/creator?tab=profiel",
        "Maak eerst je maker-pagina aan voordat je rollen kiest."
      );
    }

    const creatorTypes = sanitizeCreatorTypes(
      (formData.getAll("creator_types") ?? [])
        .map((value) => value.toString())
        .filter(Boolean)
    );

    const supabase = createPlatformClient();
    const { error } = await supabase
      .from("creators")
      .update({ creator_types: creatorTypes })
      .eq("id", creator.id)
      .eq("user_id", user.id);

    if (error) {
      fail("/dashboard/account", "Rollen opslaan mislukt.");
    }

    const roleSyncError = await syncCreatorAccountRoles(
      user.id,
      creatorTypes,
      supabase
    );
    if (roleSyncError) {
      fail("/dashboard/account", "Accountrollen konden niet worden bijgewerkt.");
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/creator");
    revalidatePath("/dashboard/account");
    revalidatePath(`/creator/${creator.slug}`);
    ok("/dashboard/account", "Je rollen zijn opgeslagen.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/account",
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

    if (targetType !== "project") {
      const creatorOwnsTarget = await creatorOwnsEntityTarget(
        creator.id,
        targetType,
        targetId
      );
      if (!creatorOwnsTarget) {
        fail(
          "/dashboard/creator",
          "Je kan alleen linken naar je eigen producten, workshops, events, artikels of projecten."
        );
      }
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

export async function createProjectGalleryImageAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const projectId = parseRequiredUuid(formData, "project_id");
    const altText = parseOptionalString(formData, "alt_text");
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;
    const linkedProject = await getCreatorLinkedProject(creator.id, projectId);

    if (!linkedProject) {
      fail("/dashboard/creator", "Project niet gelinkt aan jouw creator-profiel.");
    }

    const user = await getAuthUser();
    if (!user) {
      fail("/login?next=/dashboard/creator", "Meld je eerst aan.");
    }

    const imageUrl = await requireUploadedImageUrl(
      formData,
      "image_file",
      `projects/${user.id}/${projectId}/gallery`
    );

    const supabase = createPlatformClient();
    const { error } = await supabase.from("project_gallery_images").insert({
      project_id: projectId,
      image_url: imageUrl,
      alt_text: altText,
      sort_order: sortOrder,
    });

    if (error) {
      fail("/dashboard/creator", "Galerijafbeelding toevoegen mislukt.");
    }

    revalidatePath("/dashboard/creator");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok("/dashboard/creator", "Galerijafbeelding toegevoegd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProjectGalleryImageAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const galleryImageId = parseRequiredUuid(formData, "gallery_image_id");
    const supabase = createPlatformClient();
    const { data: row } = await supabase
      .from("project_gallery_images")
      .select("id,project_id")
      .eq("id", galleryImageId)
      .maybeSingle();

    if (!row?.project_id) {
      fail("/dashboard/creator", "Galerijafbeelding niet gevonden.");
    }

    const linkedProject = await getCreatorLinkedProject(creator.id, row.project_id as string);
    if (!linkedProject) {
      fail("/dashboard/creator", "Geen rechten op dit project.");
    }

    const { error } = await supabase
      .from("project_gallery_images")
      .delete()
      .eq("id", galleryImageId);
    if (error) {
      fail("/dashboard/creator", "Verwijderen van galerijafbeelding mislukt.");
    }

    revalidatePath("/dashboard/creator");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok("/dashboard/creator", "Galerijafbeelding verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProjectProductLinkAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const projectId = parseRequiredUuid(formData, "project_id");
    const productId = parseRequiredUuid(formData, "product_id");
    const linkType = parseOptionalString(formData, "link_type") ?? "material";
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;
    const linkedProject = await getCreatorLinkedProject(creator.id, projectId);

    if (!linkedProject) {
      fail("/dashboard/creator", "Project niet gelinkt aan jouw creator-profiel.");
    }

    const ownsProduct = await creatorOwnsEntityTarget(creator.id, "product", productId);
    const supabase = createPlatformClient();
    const { data: productRow } = await supabase
      .from("products")
      .select("product_type")
      .eq("id", productId)
      .maybeSingle();
    const isMaterialProduct =
      productRow &&
      (productRow as { product_type?: string }).product_type &&
      ["supply", "workshop_kit", "supplies"].includes(
        (productRow as { product_type: string }).product_type
      );
    if (!ownsProduct && !isMaterialProduct) {
      fail(
        "/dashboard/creator",
        "Je kan alleen je eigen producten of materialen (supply/workshop_kit) uit de webshop koppelen."
      );
    }

    const { error } = await supabase.from("project_product_links").upsert(
      {
        project_id: projectId,
        product_id: productId,
        link_type: linkType,
        sort_order: sortOrder,
      },
      { onConflict: "project_id,product_id" }
    );
    if (error) {
      fail("/dashboard/creator", "Product koppelen aan project mislukt.");
    }

    revalidatePath("/dashboard/creator");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok("/dashboard/creator", "Product gekoppeld aan project.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProjectProductLinkAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const projectProductLinkId = parseRequiredUuid(formData, "project_product_link_id");
    const supabase = createPlatformClient();
    const { data: row } = await supabase
      .from("project_product_links")
      .select("id,project_id")
      .eq("id", projectProductLinkId)
      .maybeSingle();

    if (!row?.project_id) {
      fail("/dashboard/creator", "Project-productlink niet gevonden.");
    }

    const linkedProject = await getCreatorLinkedProject(creator.id, row.project_id as string);
    if (!linkedProject) {
      fail("/dashboard/creator", "Geen rechten op dit project.");
    }

    const { error } = await supabase
      .from("project_product_links")
      .delete()
      .eq("id", projectProductLinkId);
    if (error) {
      fail("/dashboard/creator", "Verwijderen van project-productlink mislukt.");
    }

    revalidatePath("/dashboard/creator");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok("/dashboard/creator", "Project-productlink verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProjectSoughtMaterialAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const projectId = parseRequiredUuid(formData, "project_id");
    const title = parseRequiredString(formData, "title");
    const notes = parseOptionalString(formData, "notes");
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;
    const linkedProject = await getCreatorLinkedProject(creator.id, projectId);

    if (!linkedProject) {
      fail("/dashboard/creator", "Project niet gelinkt aan jouw creator-profiel.");
    }

    const { insertProjectSoughtMaterial } = await import("@/lib/platform/queries/projects");
    const material = await insertProjectSoughtMaterial(projectId, title, {
      notes,
      sort_order: sortOrder,
    });

    if (!material) {
      fail(
        "/dashboard/creator",
        "Gezocht materiaal toevoegen mislukt. Mogelijk bestaat het al."
      );
    }

    revalidatePath("/dashboard/creator");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok("/dashboard/creator", "Materiaal gezocht toegevoegd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProjectSoughtMaterialAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const soughtMaterialId = parseRequiredUuid(formData, "sought_material_id");
    const supabase = createPlatformClient();
    const { data: row } = await supabase
      .from("project_sought_materials")
      .select("id, project_id")
      .eq("id", soughtMaterialId)
      .maybeSingle();

    if (!row?.project_id) {
      fail("/dashboard/creator", "Gezocht materiaal niet gevonden.");
    }

    const linkedProject = await getCreatorLinkedProject(creator.id, row.project_id);
    if (!linkedProject) {
      fail("/dashboard/creator", "Geen rechten op dit project.");
    }

    const { deleteProjectSoughtMaterial } = await import("@/lib/platform/queries/projects");
    const okDel = await deleteProjectSoughtMaterial(soughtMaterialId);
    if (!okDel) {
      fail("/dashboard/creator", "Verwijderen mislukt.");
    }

    revalidatePath("/dashboard/creator");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok("/dashboard/creator", "Gezocht materiaal verwijderd.");
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

    if (!isAuthorableArticleType(articleType)) {
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

    if (!isAuthorableArticleType(articleType)) {
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

    const isActive = !!formData.get("is_active");
    const creditCheck = await enforceHandmadePublishCredits(
      creator.id,
      creator.creator_types ?? [],
      isActive,
      false
    );
    if (!creditCheck.ok) {
      fail("/dashboard/products", creditCheck.error ?? "Publiceren mislukt.");
    }

    const featuredImageUrl = await resolveProductImageUrl(formData, {
      fileField: "featured_image_file",
      urlField: "featured_image_url",
      pathPrefix: `creators/${creator.id}/products`,
    });

    const result = await createCreatorMarketplaceProduct({
      sellerId,
      platformCreatorId: creator.id,
      title,
      slug: parseOptionalString(formData, "slug"),
      shortDescription: parseOptionalString(formData, "short_description"),
      description: parseOptionalString(formData, "description"),
      featuredImageUrl,
      conditionType:
        (conditionType as "new" | "handmade" | "made_to_order" | "used" | null) ??
        null,
      personalizationAvailable,
      estimatedDispatchDays,
      platformDomainId: domainId,
      platformCategoryId: categoryId,
      isActive,
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
      "Product aangemaakt. De afbeelding kan enkele seconden duren voordat ze zichtbaar is op de site — zet het product op actief om het te publiceren."
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
      .select("id,medusa_product_id,featured_image_url")
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

      const featuredImageUrl = await resolveProductImageUrl(formData, {
        fileField: "featured_image_file",
        urlField: "featured_image_url",
        existingUrl: existingProduct.featured_image_url,
        pathPrefix: `creators/${creator.id}/products`,
      });

      const result = await updateCreatorMarketplaceProduct({
        sellerId,
        medusaProductId,
        platformCreatorId: creator.id,
        title,
        slug: parseOptionalString(formData, "slug"),
        shortDescription: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        featuredImageUrl,
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
    const featuredImageUrl = await resolveProductImageUrl(formData, {
      fileField: "featured_image_file",
      urlField: "featured_image_url",
      existingUrl: existingProduct.featured_image_url,
      pathPrefix: `creators/${creator.id}/products`,
    });

    const { error } = await supabase
      .from("products")
      .update({
        slug,
        title,
        short_description: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        featured_image_url: featuredImageUrl,
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

    const isActive = !!formData.get("is_active");
    const enforced = await enforceWorkshopBookingFields(
      creator.id,
      creator.creator_types ?? [],
      {
        booking_mode: bookingMode,
        booking_url: parseOptionalString(formData, "booking_url"),
        is_active: isActive,
      }
    );
    if (enforced.error) {
      fail("/dashboard/workshops", enforced.error);
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
      booking_mode: enforced.booking_mode,
      booking_url: enforced.booking_url,
      city: parseOptionalString(formData, "city"),
      location_name: parseOptionalString(formData, "location_name"),
      duration_minutes: parseOptionalInt(formData, "duration_minutes"),
      capacity: parseOptionalInt(formData, "capacity"),
      price_cents: parseOptionalInt(formData, "price_cents") ?? 0,
      currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
      is_active: isActive,
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

    const isActive = !!formData.get("is_active");
    const enforced = await enforceWorkshopBookingFields(
      creator.id,
      creator.creator_types ?? [],
      {
        booking_mode: bookingMode,
        booking_url: parseOptionalString(formData, "booking_url"),
        is_active: isActive,
        excludeWorkshopId: workshopId,
      }
    );
    if (enforced.error) {
      fail("/dashboard/workshops", enforced.error);
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
        booking_mode: enforced.booking_mode,
        booking_url: enforced.booking_url,
        city: parseOptionalString(formData, "city"),
        location_name: parseOptionalString(formData, "location_name"),
        duration_minutes: parseOptionalInt(formData, "duration_minutes"),
        capacity: parseOptionalInt(formData, "capacity"),
        price_cents: parseOptionalInt(formData, "price_cents") ?? 0,
        currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
        is_active: isActive,
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

    const enforcedTicketing = await enforceEventTicketingFields(
      creator.id,
      creator.creator_types ?? [],
      null,
      {
        ticketing_mode: ticketingMode,
        ticket_url: parseOptionalString(formData, "ticket_url"),
      }
    );

    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("events", preferredSlug);
    const supabase = createPlatformClient();

    const { data: createdEvent, error } = await supabase
      .from("events")
      .insert({
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
      ticketing_mode: enforcedTicketing.ticketing_mode,
      ticket_url: enforcedTicketing.ticket_url,
      ticket_price_cents: parseOptionalInt(formData, "ticket_price_cents"),
      currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
      featured_image_url: parseOptionalString(formData, "featured_image_url"),
      is_active: !!formData.get("is_active"),
    })
      .select("id")
      .single();

    if (error || !createdEvent?.id) {
      fail("/dashboard/events", "Event aanmaken mislukt.");
    }

    await attachDefaultEventPlan(createdEvent.id as string);

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

    const { getEventCommercialEntitlements } = await import(
      "@/lib/platform/commercial-entitlements"
    );
    const eventEntitlements = await getEventCommercialEntitlements(eventId);
    const enforcedTicketing = await enforceEventTicketingFields(
      creator.id,
      creator.creator_types ?? [],
      eventEntitlements.externalLinksAllowed,
      {
        ticketing_mode: ticketingMode,
        ticket_url: parseOptionalString(formData, "ticket_url"),
      }
    );

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
        ticketing_mode: enforcedTicketing.ticketing_mode,
        ticket_url: enforcedTicketing.ticket_url,
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

export async function linkWorkshopProductAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const workshopId = parseRequiredUuid(formData, "workshop_id");
    const productId = parseRequiredUuid(formData, "product_id");
    const isRequired = !!formData.get("is_required");
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;

    const supabase = createPlatformClient();
    const { data: workshop } = await supabase
      .from("workshops")
      .select("id, slug")
      .eq("id", workshopId)
      .eq("creator_id", creator.id)
      .maybeSingle();

    if (!workshop) {
      fail("/dashboard/workshops", "Workshop niet gevonden.");
    }

    const { data: productRow } = await supabase
      .from("products")
      .select("product_type, creator_id")
      .eq("id", productId)
      .maybeSingle();

    const ownsProduct = productRow?.creator_id === creator.id;
    const isMaterialProduct =
      productRow &&
      ["supply", "workshop_kit", "supplies"].includes(productRow.product_type);

    if (!ownsProduct && !isMaterialProduct) {
      fail(
        "/dashboard/workshops",
        "Je kan alleen je eigen producten of materialen (supply/workshop_kit) koppelen."
      );
    }

    const { error } = await supabase.from("workshop_required_products").upsert(
      {
        workshop_id: workshopId,
        product_id: productId,
        is_required: isRequired,
        sort_order: sortOrder,
      },
      { onConflict: "workshop_id,product_id" }
    );

    if (error) {
      fail("/dashboard/workshops", "Materiaal koppelen mislukt.");
    }

    revalidatePath("/dashboard/workshops");
    revalidatePath(`/workshop/${workshop.slug}`);
    ok("/dashboard/workshops", "Materiaal gekoppeld aan workshop.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/workshops",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function unlinkWorkshopProductAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const workshopId = parseRequiredUuid(formData, "workshop_id");
    const productId = parseRequiredUuid(formData, "product_id");

    const supabase = createPlatformClient();
    const { data: workshop } = await supabase
      .from("workshops")
      .select("slug")
      .eq("id", workshopId)
      .eq("creator_id", creator.id)
      .maybeSingle();

    if (!workshop) {
      fail("/dashboard/workshops", "Workshop niet gevonden.");
    }

    const { error } = await supabase
      .from("workshop_required_products")
      .delete()
      .eq("workshop_id", workshopId)
      .eq("product_id", productId);

    if (error) {
      fail("/dashboard/workshops", "Materiaal ontkoppelen mislukt.");
    }

    revalidatePath("/dashboard/workshops");
    revalidatePath(`/workshop/${workshop.slug}`);
    ok("/dashboard/workshops", "Materiaal ontkoppeld.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/workshops",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function purchaseSpotlightBoostFormAction(
  formData: FormData
): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const entityType = parseRequiredString(formData, "entity_type") as
      | "creator"
      | "product"
      | "workshop"
      | "event";
    const entityId = parseRequiredUuid(formData, "entity_id");
    const boostType =
      parseOptionalString(formData, "boost_type") === "homepage"
        ? "homepage"
        : "spotlight";

    const result = await purchaseSpotlightBoostAction({
      creatorId: creator.id,
      entityType,
      entityId,
      boostType,
    });

    if (!result.ok) {
      fail("/dashboard/creator", result.error ?? "Spotlight aankoop mislukt.");
    }

    revalidatePath("/dashboard/creator");
    ok("/dashboard/creator", "Spotlight geactiveerd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/creator",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function addListingCreditsAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreator();
    const packCode = parseRequiredString(formData, "pack_code");
    const supabase = createPlatformClient();
    const { data: pack } = await supabase
      .from("listing_credit_products")
      .select("credits, name")
      .eq("pack_code", packCode)
      .eq("is_active", true)
      .maybeSingle();

    if (!pack) {
      fail("/dashboard/products", "Creditpakket niet gevonden.");
    }

    const result = await addCredits(creator.id, pack.credits, "purchase", {
      pack_code: packCode,
    });

    if (!result.ok) {
      fail("/dashboard/products", result.error ?? "Credits toevoegen mislukt.");
    }

    revalidatePath("/dashboard/products");
    ok("/dashboard/products", `${pack.credits} credits toegevoegd (${pack.name}).`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/products",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}
