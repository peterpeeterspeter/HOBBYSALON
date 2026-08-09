"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPlatformClient,
} from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorById, getCreatorByUserId } from "@/lib/platform/queries/creators";
import { isModerator } from "@/lib/platform/queries/community-showcase";
import {
  cancelCreatorOrder,
  completeCreatorOrder,
} from "@/lib/commerce/medusa/creator-orders";
import {
  deleteCreatorMarketplaceProduct,
  updateCreatorMarketplaceProduct,
} from "@/lib/commerce/medusa/creator-products";
import { ensureCreatorSellerLinked } from "@/lib/commerce/medusa/creator-onboarding";
import { requireUploadedImageUrl, resolveProductImageUrl } from "@/lib/storage/upload-image";
import {
  attachDefaultEventPlan,
  enforceCreatorSocialUrls,
  enforceEventPublishCredits,
  enforceEventTicketingFields,
  enforceHandmadePublishCredits,
  enforceWorkshopBookingFields,
  purchaseSpotlightBoostAction,
} from "@/lib/platform/commercial-enforcement";
import { addCredits } from "@/lib/platform/listing-credits";
import { isAuthorableArticleType } from "@/lib/content/article-types";
import { creatorMakerProfileUrl } from "@/lib/profile/creator-maker-path";
import { parseSpecialtyTagsInput } from "@/lib/creators/specialty-tags";
import {
  ROLE_REQUEST_PENDING_MESSAGE,
  syncPrivilegedRolesFromCreatorTypes,
} from "@/lib/platform/queries/role-requests";
import { getUserAccountRoles, getUserRegistrationContext, updateUserOfferIntent } from "@/lib/platform/queries/user-registration";
import { getWorkshopCategoryById } from "@/lib/platform/queries/workshop-categories";
import {
  isWorkshopAgeGroup,
  isWorkshopAudienceType,
  isWorkshopLanguage,
  isWorkshopOfferType,
  parseWorkshopCodeList,
} from "@/lib/platform/workshop-taxonomy";

const CREATOR_MAKER_PATH = creatorMakerProfileUrl({ tab: "profiel" });

const PRODUCT_TYPES = new Set([
  "supply",
  "handmade",
  "destash",
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

const WORKSHOP_FORMATS = new Set(["physical", "online", "hybrid"]);
const WORKSHOP_DIFFICULTY = new Set(["beginner", "intermediate", "advanced"]);
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

/** `datetime-local` → ISO UTC for Postgres timestamptz. */
function parseRequiredDateTimeLocal(formData: FormData, field: string): string {
  const raw = parseRequiredString(formData, field);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Ongeldige datum of tijd.");
  }
  return date.toISOString();
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

async function parseWorkshopTaxonomyFields(
  formData: FormData,
  domainId: string | null
): Promise<{
  category_id: string | null;
  offer_type: string | null;
  audience_types: string[];
  age_groups: string[];
  languages: string[];
}> {
  const categoryId = parseOptionalUuid(formData, "category_id");
  const offerRaw = parseOptionalString(formData, "offer_type");
  if (offerRaw && !isWorkshopOfferType(offerRaw)) {
    throw new Error("Ongeldige aanbodvorm.");
  }

  const audience_types = parseWorkshopCodeList(
    formData.getAll("audience_types").map((value) => value.toString()),
    isWorkshopAudienceType
  );
  const age_groups = parseWorkshopCodeList(
    formData.getAll("age_groups").map((value) => value.toString()),
    isWorkshopAgeGroup
  );
  const languages = parseWorkshopCodeList(
    formData.getAll("languages").map((value) => value.toString()),
    isWorkshopLanguage
  );

  if (languages.length === 0) {
    throw new Error("Kies minstens één taal.");
  }

  if (categoryId) {
    if (!domainId) {
      throw new Error("Kies eerst een domein voor de subcategorie.");
    }
    const category = await getWorkshopCategoryById(categoryId);
    if (!category || !category.is_active) {
      throw new Error("Ongeldige subcategorie.");
    }
    if (category.domain_id !== domainId) {
      throw new Error("Subcategorie hoort niet bij het gekozen domein.");
    }
  }

  return {
    category_id: categoryId,
    offer_type: offerRaw,
    audience_types,
    age_groups,
    languages,
  };
}

async function assertProductCategoryMatchesDomain(
  categoryId: string | null,
  domainId: string | null
): Promise<void> {
  if (!categoryId) return;
  if (!domainId) {
    throw new Error("Kies eerst een domein voor de categorie.");
  }
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, domain_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Ongeldige categorie.");
  }
  if (data.domain_id !== domainId) {
    throw new Error("Categorie hoort niet bij het gekozen domein.");
  }
}

function parseOptionalCurrencyCode(formData: FormData, field: string): string | null {
  const raw = formData.get(field)?.toString().trim().toUpperCase();
  if (!raw) return null;
  if (!/^[A-Z]{3}$/.test(raw)) {
    throw new Error(`${field} is ongeldig.`);
  }
  return raw;
}

function parseOptionalEuroToCents(formData: FormData, field: string): number | null {
  const raw = formData.get(field)?.toString().trim();
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${field} is ongeldig.`);
  }
  return Math.round(parsed * 100);
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

async function getRequiredCreatorProfile(loginNext = "/dashboard") {
  const user = await getAuthUser();
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(loginNext)}&error=${encodeURIComponent(
        "Je sessie is verlopen. Meld je opnieuw aan — je formulier wordt hersteld als je terugkomt."
      )}`
    );
  }

  const creator = await getCreatorByUserId(user.id);
  if (!creator) {
    throw new Error("Maak eerst een creator-profiel aan.");
  }

  return { user, creator };
}

const MAX_GALLERY_IMAGES = 8;

function parseGalleryImageUrls(formData: FormData, max = MAX_GALLERY_IMAGES): string[] {
  return formData
    .getAll("gallery_image_urls")
    .map((value) => value.toString().trim())
    .filter((url) => url.length > 0)
    .slice(0, max);
}

async function countGalleryImages(
  table: "product_gallery_images" | "workshop_gallery_images" | "event_gallery_images",
  foreignKey: "product_id" | "workshop_id" | "event_id",
  entityId: string
): Promise<number> {
  const supabase = createPlatformClient();
  const { count } = await supabase
    .from(table)
    .select("id", { head: true, count: "exact" })
    .eq(foreignKey, entityId);
  return count ?? 0;
}

/**
 * Creator profile + draft permission for workshops/events.
 * Drafts: approved role OR matching creator_type OR pending role request.
 * Publishing (is_active) still requires getRequiredPublishCreator.
 */
async function getRequiredDraftCreator(role: "workshop_host" | "organizer") {
  const { user, creator } = await getRequiredCreatorProfile();
  const [roles, context] = await Promise.all([
    getUserAccountRoles(user.id),
    getUserRegistrationContext(user.id),
  ]);

  if (roles.includes(role)) {
    return { user, creator, canPublish: true as const };
  }

  const creatorTypes = (creator.creator_types ?? []).map((value) =>
    value.toLowerCase()
  );
  const declaredType =
    role === "workshop_host" ? "workshopgever" : "organizer";
  const wantsRole = creatorTypes.includes(declaredType);
  const pending = context.pendingRoleRequests.some(
    (request) => request.role === role && request.status === "pending"
  );
  const rejected = context.pendingRoleRequests.some(
    (request) => request.role === role && request.status === "rejected"
  );

  if (rejected && !pending) {
    throw new Error(ROLE_REQUEST_PENDING_MESSAGE);
  }

  if (!wantsRole && !pending) {
    throw new Error(ROLE_REQUEST_PENDING_MESSAGE);
  }

  return { user, creator, canPublish: false as const };
}

async function assertCanPublishListing(
  canPublish: boolean,
  isActive: boolean,
  failPath: string
): Promise<void> {
  if (isActive && !canPublish) {
    fail(
      failPath,
      "Publiceren kan pas nadat je aanbiedersrol is goedgekeurd. Sla op als concept."
    );
  }
}

/** Creator profile + optional Medusa seller (only needed for commerce-linked products). */
async function getRequiredCreator() {
  const { user, creator } = await getRequiredCreatorProfile();

  const supabase = createPlatformClient();
  const { data: sellerLinks, error: sellerLinkError } = await supabase
    .from("user_seller_links")
    .select("seller_id, seller_type")
    .eq("user_id", user.id);

  if (sellerLinkError) {
    throw new Error("Kon creator-seller koppeling niet ophalen.");
  }

  const preferredLink =
    sellerLinks?.find((link) => link.seller_type === "creator") ??
    sellerLinks?.find((link) => link.seller_type === "merchant");

  if (!preferredLink?.seller_id) {
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

  return { user, creator, sellerId: preferredLink.seller_id as string };
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
  const { error } = await supabase.from("user_account_roles").upsert(
    {
      user_id: userId,
      role: "creator",
    },
    { onConflict: "user_id,role" }
  );
  if (error) {
    return error.message;
  }

  return syncPrivilegedRolesFromCreatorTypes(userId, creatorTypes, {
    source: "creator_profile_sync",
  });
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
      fail("/login?next=/profile", "Meld je eerst aan.");
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
    const avatarUrl = await resolveProductImageUrl(formData, {
      fileField: "avatar_file",
      urlField: "avatar_file_uploaded_url",
      existingUrl: existing?.avatar_url,
      pathPrefix: `creators/${user.id}/avatar`,
    });
    const bannerUrl = await resolveProductImageUrl(formData, {
      fileField: "banner_file",
      urlField: "banner_file_uploaded_url",
      existingUrl: existing?.banner_url,
      pathPrefix: `creators/${user.id}/banner`,
    });

    const socialUrls = await enforceCreatorSocialUrls(
      existing?.id ?? "",
      creatorTypes,
      {
        website_url: parseOptionalString(formData, "website_url"),
        instagram_url: parseOptionalString(formData, "instagram_url"),
        facebook_url: parseOptionalString(formData, "facebook_url"),
      }
    );

    const email = parseOptionalString(formData, "email") ?? existing?.email ?? user.email ?? null;
    const specialtyTags = parseSpecialtyTagsInput(
      parseOptionalString(formData, "specialty_tags")
    );

    const payload = {
      user_id: user.id,
      slug,
      display_name: displayName,
      business_name: parseOptionalString(formData, "business_name"),
      email,
      bio: parseOptionalString(formData, "bio"),
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      website_url: socialUrls.website_url,
      instagram_url: socialUrls.instagram_url,
      facebook_url: socialUrls.facebook_url,
      city: parseOptionalString(formData, "city"),
      country_code: parseOptionalString(formData, "country_code") ?? "BE",
      creator_types: creatorTypes,
      open_to_markets: !!formData.get("open_to_markets"),
      specialty_tags: specialtyTags,
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
        fail(CREATOR_MAKER_PATH, "Opslaan van creator-profiel mislukt.");
      }

      const domainSyncError = await syncCreatorDomains(
        existing.id,
        selectedDomainIds,
        supabase
      );
      if (domainSyncError) {
        fail(CREATOR_MAKER_PATH, "Opslaan van hobby-domeinen mislukt.");
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
        fail(CREATOR_MAKER_PATH, "Aanmaken van creator-profiel mislukt.");
      }

      const domainSyncError = await syncCreatorDomains(
        insertedRows[0].id as string,
        selectedDomainIds,
        supabase
      );
      if (domainSyncError) {
        fail(CREATOR_MAKER_PATH, "Opslaan van hobby-domeinen mislukt.");
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
      fail(CREATOR_MAKER_PATH, "Creator-rol kon niet worden opgeslagen.");
    }

    revalidatePath("/dashboard");
    revalidatePath("/profile");
    revalidatePath("/creators");
    revalidatePath(`/creator/${finalCreatorSlug}`);
    ok(CREATOR_MAKER_PATH, "Creator-profiel opgeslagen.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function updateCreatorTypesAction(formData: FormData): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      fail("/login?next=/dashboard", "Meld je eerst aan.");
    }

    const creator = await getCreatorByUserId(user.id);
    if (!creator) {
      fail(
        "/dashboard#account",
        "Start eerst als aanbieder voordat je rollen kiest."
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
      fail("/dashboard", "Rollen opslaan mislukt.");
    }

    const roleSyncError = await syncCreatorAccountRoles(
      user.id,
      creatorTypes,
      supabase
    );
    if (roleSyncError) {
      fail("/dashboard", "Accountrollen konden niet worden bijgewerkt.");
    }

    const { creatorTypesToOfferRoles } = await import("@/lib/auth/role-upgrades");
    const context = await getUserRegistrationContext(user.id);
    const fromTypes = creatorTypesToOfferRoles(creatorTypes);
    const existingOffer = context.preference?.offerRoles ?? [];
    const merchantKept = existingOffer.includes("merchant") ? (["merchant"] as const) : [];
    const mergedOfferRoles = Array.from(
      new Set([...existingOffer.filter((r) => r !== "merchant"), ...fromTypes, ...merchantKept])
    );
    if (mergedOfferRoles.length > 0) {
      await updateUserOfferIntent({
        userId: user.id,
        offerRoles: mergedOfferRoles,
        primaryOfferRole:
          context.preference?.primaryOfferRole &&
          mergedOfferRoles.includes(context.preference.primaryOfferRole)
            ? context.preference.primaryOfferRole
            : mergedOfferRoles[0] ?? null,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/profile");
    revalidatePath(`/creator/${creator.slug}`);
    ok(
      "/dashboard",
      "Je rollen zijn opgeslagen. Nieuwe rollen wachten op goedkeuring."
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createCreatorEntityLinkAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const targetType = parseRequiredString(formData, "target_entity_type");
    const targetId = parseRequiredUuid(formData, "target_entity_id");
    const relationType = parseRequiredString(formData, "relation_type").toLowerCase();
    const weight = parseOptionalInt(formData, "weight") ?? 1;
    const sortOrder = parseOptionalInt(formData, "sort_order");

    if (!ENTITY_LINK_TARGET_TYPES.has(targetType)) {
      fail(CREATOR_MAKER_PATH, "Ongeldig target type.");
    }

    if (targetType !== "project") {
      const creatorOwnsTarget = await creatorOwnsEntityTarget(
        creator.id,
        targetType,
        targetId
      );
      if (!creatorOwnsTarget) {
        fail(
          CREATOR_MAKER_PATH,
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
      fail(CREATOR_MAKER_PATH, "Deze link bestaat al.");
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
      fail(CREATOR_MAKER_PATH, "Aanmaken van entity link mislukt.");
    }

    revalidatePath("/profile");
    revalidatePath(`/creator/${creator.slug}`);
    ok(CREATOR_MAKER_PATH, "Entity link toegevoegd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteCreatorEntityLinkAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const entityLinkId = parseRequiredUuid(formData, "entity_link_id");
    const supabase = createPlatformClient();
    const { error } = await supabase
      .from("entity_links")
      .delete()
      .eq("id", entityLinkId)
      .eq("source_entity_type", "creator")
      .eq("source_entity_id", creator.id);

    if (error) {
      fail(CREATOR_MAKER_PATH, "Verwijderen van entity link mislukt.");
    }

    revalidatePath("/profile");
    revalidatePath(`/creator/${creator.slug}`);
    ok(CREATOR_MAKER_PATH, "Entity link verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProjectGalleryImageAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const projectId = parseRequiredUuid(formData, "project_id");
    const altText = parseOptionalString(formData, "alt_text");
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;
    const linkedProject = await getCreatorLinkedProject(creator.id, projectId);

    if (!linkedProject) {
      fail(CREATOR_MAKER_PATH, "Project niet gelinkt aan jouw creator-profiel.");
    }

    const user = await getAuthUser();
    if (!user) {
      fail("/login?next=/profile", "Meld je eerst aan.");
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
      fail(CREATOR_MAKER_PATH, "Galerijafbeelding toevoegen mislukt.");
    }

    revalidatePath("/profile");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok(CREATOR_MAKER_PATH, "Galerijafbeelding toegevoegd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProjectGalleryImageAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const galleryImageId = parseRequiredUuid(formData, "gallery_image_id");
    const supabase = createPlatformClient();
    const { data: row } = await supabase
      .from("project_gallery_images")
      .select("id,project_id")
      .eq("id", galleryImageId)
      .maybeSingle();

    if (!row?.project_id) {
      fail(CREATOR_MAKER_PATH, "Galerijafbeelding niet gevonden.");
    }

    const linkedProject = await getCreatorLinkedProject(creator.id, row.project_id as string);
    if (!linkedProject) {
      fail(CREATOR_MAKER_PATH, "Geen rechten op dit project.");
    }

    const { error } = await supabase
      .from("project_gallery_images")
      .delete()
      .eq("id", galleryImageId);
    if (error) {
      fail(CREATOR_MAKER_PATH, "Verwijderen van galerijafbeelding mislukt.");
    }

    revalidatePath("/profile");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok(CREATOR_MAKER_PATH, "Galerijafbeelding verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProjectProductLinkAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const projectId = parseRequiredUuid(formData, "project_id");
    const productId = parseRequiredUuid(formData, "product_id");
    const linkType = parseOptionalString(formData, "link_type") ?? "material";
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;
    const linkedProject = await getCreatorLinkedProject(creator.id, projectId);

    if (!linkedProject) {
      fail(CREATOR_MAKER_PATH, "Project niet gelinkt aan jouw creator-profiel.");
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
        CREATOR_MAKER_PATH,
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
      fail(CREATOR_MAKER_PATH, "Product koppelen aan project mislukt.");
    }

    revalidatePath("/profile");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok(CREATOR_MAKER_PATH, "Product gekoppeld aan project.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProjectProductLinkAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const projectProductLinkId = parseRequiredUuid(formData, "project_product_link_id");
    const supabase = createPlatformClient();
    const { data: row } = await supabase
      .from("project_product_links")
      .select("id,project_id")
      .eq("id", projectProductLinkId)
      .maybeSingle();

    if (!row?.project_id) {
      fail(CREATOR_MAKER_PATH, "Project-productlink niet gevonden.");
    }

    const linkedProject = await getCreatorLinkedProject(creator.id, row.project_id as string);
    if (!linkedProject) {
      fail(CREATOR_MAKER_PATH, "Geen rechten op dit project.");
    }

    const { error } = await supabase
      .from("project_product_links")
      .delete()
      .eq("id", projectProductLinkId);
    if (error) {
      fail(CREATOR_MAKER_PATH, "Verwijderen van project-productlink mislukt.");
    }

    revalidatePath("/profile");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok(CREATOR_MAKER_PATH, "Project-productlink verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProjectSoughtMaterialAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const projectId = parseRequiredUuid(formData, "project_id");
    const title = parseRequiredString(formData, "title");
    const notes = parseOptionalString(formData, "notes");
    const sortOrder = parseOptionalInt(formData, "sort_order") ?? 0;
    const linkedProject = await getCreatorLinkedProject(creator.id, projectId);

    if (!linkedProject) {
      fail(CREATOR_MAKER_PATH, "Project niet gelinkt aan jouw creator-profiel.");
    }

    const { insertProjectSoughtMaterial } = await import("@/lib/platform/queries/projects");
    const material = await insertProjectSoughtMaterial(projectId, title, {
      notes,
      sort_order: sortOrder,
    });

    if (!material) {
      fail(
        CREATOR_MAKER_PATH,
        "Gezocht materiaal toevoegen mislukt. Mogelijk bestaat het al."
      );
    }

    revalidatePath("/profile");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok(CREATOR_MAKER_PATH, "Materiaal gezocht toegevoegd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProjectSoughtMaterialAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const soughtMaterialId = parseRequiredUuid(formData, "sought_material_id");
    const supabase = createPlatformClient();
    const { data: row } = await supabase
      .from("project_sought_materials")
      .select("id, project_id")
      .eq("id", soughtMaterialId)
      .maybeSingle();

    if (!row?.project_id) {
      fail(CREATOR_MAKER_PATH, "Gezocht materiaal niet gevonden.");
    }

    const linkedProject = await getCreatorLinkedProject(creator.id, row.project_id);
    if (!linkedProject) {
      fail(CREATOR_MAKER_PATH, "Geen rechten op dit project.");
    }

    const { deleteProjectSoughtMaterial } = await import("@/lib/platform/queries/projects");
    const okDel = await deleteProjectSoughtMaterial(soughtMaterialId);
    if (!okDel) {
      fail(CREATOR_MAKER_PATH, "Verwijderen mislukt.");
    }

    revalidatePath("/profile");
    revalidatePath(`/creator/${creator.slug}`);
    revalidatePath(`/project/${linkedProject.slug}`);
    ok(CREATOR_MAKER_PATH, "Gezocht materiaal verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createArticleAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const title = parseRequiredString(formData, "title");
    const articleType = parseRequiredString(formData, "article_type");
    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("articles", preferredSlug);
    const excerpt = parseOptionalString(formData, "excerpt");
    const bodyMarkdown = parseOptionalString(formData, "body_markdown");
    const domainId = parseOptionalUuid(formData, "domain_id");

    if (!isAuthorableArticleType(articleType)) {
      fail(CREATOR_MAKER_PATH, "Ongeldig artikeltype.");
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
      fail(CREATOR_MAKER_PATH, "Aanmaken van artikel mislukt.");
    }

    await generateArticleLinkSuggestions({
      creatorId: creator.id,
      articleId: article.id,
      articleDomainId: domainId,
      sourceText: [title, excerpt ?? "", bodyMarkdown ?? ""].join(" "),
    });

    revalidatePath("/profile");
    ok(CREATOR_MAKER_PATH, "Artikel opgeslagen met link-suggesties.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function updateArticleAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const articleId = parseRequiredUuid(formData, "id");
    const title = parseRequiredString(formData, "title");
    const articleType = parseRequiredString(formData, "article_type");
    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("articles", preferredSlug, articleId);
    const excerpt = parseOptionalString(formData, "excerpt");
    const bodyMarkdown = parseOptionalString(formData, "body_markdown");
    const domainId = parseOptionalUuid(formData, "domain_id");

    if (!isAuthorableArticleType(articleType)) {
      fail(CREATOR_MAKER_PATH, "Ongeldig artikeltype.");
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
      fail(CREATOR_MAKER_PATH, "Bijwerken van artikel mislukt.");
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

    revalidatePath("/profile");
    ok(CREATOR_MAKER_PATH, "Artikel bijgewerkt. Suggesties vernieuwd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function approveArticleSuggestionAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
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
      fail(CREATOR_MAKER_PATH, "Suggestie niet gevonden.");
    }

    const { data: articleRow } = await supabase
      .from("articles")
      .select("id")
      .eq("id", linkRow.source_entity_id)
      .eq("author_creator_id", creator.id)
      .maybeSingle();

    if (!articleRow?.id) {
      fail(CREATOR_MAKER_PATH, "Geen rechten op deze suggestie.");
    }

    const { error } = await supabase
      .from("entity_links")
      .update({
        relation_type: relationType,
      })
      .eq("id", entityLinkId);

    if (error) {
      fail(CREATOR_MAKER_PATH, "Bevestigen van suggestie mislukt.");
    }

    revalidatePath("/profile");
    ok(CREATOR_MAKER_PATH, "Suggestie bevestigd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function dismissArticleSuggestionAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
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
      fail(CREATOR_MAKER_PATH, "Suggestie niet gevonden.");
    }

    const { data: articleRow } = await supabase
      .from("articles")
      .select("id")
      .eq("id", linkRow.source_entity_id)
      .eq("author_creator_id", creator.id)
      .maybeSingle();

    if (!articleRow?.id) {
      fail(CREATOR_MAKER_PATH, "Geen rechten op deze suggestie.");
    }

    const { error } = await supabase
      .from("entity_links")
      .delete()
      .eq("id", entityLinkId);

    if (error) {
      fail(CREATOR_MAKER_PATH, "Verwijderen van suggestie mislukt.");
    }

    revalidatePath("/profile");
    ok(CREATOR_MAKER_PATH, "Suggestie verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createProductAction(formData: FormData): Promise<void> {
  try {
    // Makers create platform listings only (contact/lead). No Medusa checkout.
    const { creator } = await getRequiredCreatorProfile("/dashboard/products");
    const title = parseRequiredString(formData, "title");
    const productType = parseRequiredString(formData, "product_type");
    const priceCents = parseOptionalEuroToCents(formData, "price_euro");
    const currencyCode =
      parseOptionalCurrencyCode(formData, "currency_code") ?? "EUR";
    const conditionType = parseOptionalString(formData, "condition_type");
    const estimatedDispatchDays = parseOptionalNonNegativeInt(
      formData,
      "estimated_dispatch_days"
    );
    const personalizationAvailable = !!formData.get("personalization_available");
    const domainId = parseOptionalUuid(formData, "domain_id");
    const categoryId = parseOptionalUuid(formData, "category_id");
    try {
      await assertProductCategoryMatchesDomain(categoryId, domainId);
    } catch (error) {
      fail(
        "/dashboard/products",
        error instanceof Error ? error.message : "Ongeldige categorie."
      );
    }

    if (!PRODUCT_TYPES.has(productType)) {
      fail("/dashboard/products", "Ongeldig producttype.");
    }

    if (productType !== "handmade" && productType !== "destash") {
      fail(
        "/dashboard/products",
        "Voor maker-plaatsingen is enkel type 'handmade' of 'destash' toegestaan."
      );
    }
    if (conditionType && !PRODUCT_CONDITION_TYPES.has(conditionType)) {
      fail("/dashboard/products", "Ongeldige conditie.");
    }
    if (priceCents === null) {
      fail("/dashboard/products", "Richtprijs is verplicht.");
    }

    const isActive = !!formData.get("is_active");
    const creditCheck = await enforceHandmadePublishCredits(
      creator.id,
      creator.creator_types ?? [],
      isActive,
      false,
      productType as "handmade" | "destash"
    );
    if (!creditCheck.ok) {
      fail("/dashboard/products", creditCheck.error ?? "Publiceren mislukt.");
    }

    const slug = await ensureUniqueSlug("products", title);
    const featuredImageUrl = await resolveProductImageUrl(formData, {
      fileField: "featured_image_file",
      urlField: "featured_image_file_uploaded_url",
      pathPrefix: `creators/${creator.id}/products`,
    });
    const galleryUrls = parseGalleryImageUrls(formData);

    const supabase = createPlatformClient();
    const { data: createdProduct, error } = await supabase
      .from("products")
      .insert({
        creator_id: creator.id,
        domain_id: domainId,
        category_id: categoryId,
        slug,
        title,
        short_description: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        featured_image_url: featuredImageUrl,
        condition_type: conditionType,
        personalization_available: personalizationAvailable,
        estimated_dispatch_days: estimatedDispatchDays,
        product_type: productType,
        price_cents: priceCents,
        currency_code: currencyCode,
        status: isActive ? "active" : "draft",
        is_active: isActive,
        medusa_product_id: null,
      })
      .select("id")
      .single();

    if (error || !createdProduct) {
      fail(
        "/dashboard/products",
        `Plaatsing aanmaken mislukt. ${error?.message ?? ""}`.trim()
      );
    }

    if (galleryUrls.length > 0) {
      const { error: galleryError } = await supabase
        .from("product_gallery_images")
        .insert(
          galleryUrls.map((image_url, index) => ({
            product_id: createdProduct.id,
            image_url,
            sort_order: index,
          }))
        );
      if (galleryError) {
        console.error("Product gallery insert failed:", galleryError);
      }
    }

    revalidatePath("/dashboard/products");
    revalidatePath(`/creator/${creator.slug}`);
    ok(
      "/dashboard/products",
      isActive
        ? "Plaatsing online. Bezoekers kunnen je contacteren via de productpagina."
        : "Plaatsing opgeslagen als concept. Zet ze op actief om te publiceren."
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/products",
      error instanceof Error ? error.message : "Plaatsing aanmaken mislukt."
    );
  }
}

export async function updateProductAction(formData: FormData): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile("/dashboard/products");
    const productId = parseRequiredString(formData, "id");
    const title = parseRequiredString(formData, "title");
    const productType = parseRequiredString(formData, "product_type");
    const stockMode = parseOptionalString(formData, "stock_mode") ?? "made_to_order";
    const priceCents =
      parseOptionalEuroToCents(formData, "price_euro") ??
      parseOptionalNonNegativeInt(formData, "price_cents");
    const currencyCode =
      parseOptionalCurrencyCode(formData, "currency_code") ?? "EUR";
    const conditionType = parseOptionalString(formData, "condition_type");
    const estimatedDispatchDays = parseOptionalNonNegativeInt(
      formData,
      "estimated_dispatch_days"
    );
    const personalizationAvailable = !!formData.get("personalization_available");
    const domainId = parseOptionalUuid(formData, "domain_id");
    const categoryId = parseOptionalUuid(formData, "category_id");
    const existingGalleryCount = await countGalleryImages(
      "product_gallery_images",
      "product_id",
      productId
    );
    const galleryUrls = parseGalleryImageUrls(
      formData,
      Math.max(0, MAX_GALLERY_IMAGES - existingGalleryCount)
    );
    try {
      await assertProductCategoryMatchesDomain(categoryId, domainId);
    } catch (error) {
      fail(
        "/dashboard/products",
        error instanceof Error ? error.message : "Ongeldige categorie."
      );
    }

    if (!PRODUCT_TYPES.has(productType)) {
      fail("/dashboard/products", "Ongeldig producttype.");
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
      .select("id,medusa_product_id,featured_image_url,is_active,price_cents,currency_code")
      .eq("id", productId)
      .eq("creator_id", creator.id)
      .maybeSingle();

    if (existingError || !existingProduct) {
      fail("/dashboard/products", "Product niet gevonden.");
    }

    const medusaProductId =
      medusaProductIdFromForm || existingProduct.medusa_product_id || null;
    const isActive = !!formData.get("is_active");

    if (isActive && !existingProduct.is_active) {
      const creditCheck = await enforceHandmadePublishCredits(
        creator.id,
        creator.creator_types ?? [],
        true,
        false,
        productType === "destash" ? "destash" : "handmade"
      );
      if (!creditCheck.ok) {
        fail("/dashboard/products", creditCheck.error ?? "Publiceren mislukt.");
      }
    }

    if (medusaProductId) {
      if (productType !== "handmade") {
        fail(
          "/dashboard/products",
          "Medusa creator-producten ondersteunen momenteel enkel type 'handmade'."
        );
      }

      const { sellerId } = await getRequiredCreator();
      const featuredImageUrl = await resolveProductImageUrl(formData, {
        fileField: "featured_image_file",
        urlField: "featured_image_file_uploaded_url",
        existingUrl: existingProduct.featured_image_url,
        pathPrefix: `creators/${creator.id}/products`,
      });

      const result = await updateCreatorMarketplaceProduct({
        sellerId,
        medusaProductId,
        platformCreatorId: creator.id,
        title,
        slug: undefined,
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
        isActive,
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

    const slug = await ensureUniqueSlug("products", title, productId);
    const featuredImageUrl = await resolveProductImageUrl(formData, {
      fileField: "featured_image_file",
      urlField: "featured_image_file_uploaded_url",
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
        price_cents: priceCents ?? existingProduct.price_cents,
        currency_code: currencyCode ?? existingProduct.currency_code ?? "EUR",
        status: isActive ? "active" : "draft",
        is_active: isActive,
      })
      .eq("id", productId)
      .eq("creator_id", creator.id);

    if (error) {
      fail("/dashboard/products", "Plaatsing bijwerken mislukt.");
    }

    if (galleryUrls.length > 0) {
      const { data: existingGallery } = await supabase
        .from("product_gallery_images")
        .select("sort_order")
        .eq("product_id", productId)
        .order("sort_order", { ascending: false })
        .limit(1);
      const startOrder =
        typeof existingGallery?.[0]?.sort_order === "number"
          ? existingGallery[0].sort_order + 1
          : 0;
      const { error: galleryError } = await supabase
        .from("product_gallery_images")
        .insert(
          galleryUrls.map((image_url, index) => ({
            product_id: productId,
            image_url,
            sort_order: startOrder + index,
          }))
        );
      if (galleryError) {
        console.error("Product gallery insert failed:", galleryError);
      }
    }

    revalidatePath("/dashboard/products");
    revalidatePath(`/creator/${creator.slug}`);
    ok("/dashboard/products", "Plaatsing bijgewerkt.");
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
    const { creator } = await getRequiredCreatorProfile();
    const productId = parseRequiredString(formData, "id");
    const medusaProductId = parseOptionalString(formData, "medusa_product_id");
    const supabase = createPlatformClient();

    if (medusaProductId) {
      const { sellerId } = await getRequiredCreator();
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
      fail("/dashboard/products", "Plaatsing depubliceren mislukt.");
    }

    revalidatePath("/dashboard/products");
    revalidatePath(`/creator/${creator.slug}`);
    ok("/dashboard/products", "Plaatsing gedeactiveerd.");
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
    const { creator } = await getRequiredCreatorProfile();
    const productId = parseRequiredString(formData, "id");
    const medusaProductId = parseOptionalString(formData, "medusa_product_id");
    const supabase = createPlatformClient();

    if (medusaProductId) {
      const { sellerId } = await getRequiredCreator();
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
    const { creator, canPublish } = await getRequiredDraftCreator("workshop_host");
    const title = parseRequiredString(formData, "title");
    const formatType = parseRequiredString(formData, "format_type");
    const difficultyLevel = parseRequiredString(formData, "difficulty_level");
    const domainId = parseOptionalUuid(formData, "domain_id");
    const optionalProductId = parseOptionalUuid(formData, "product_id");
    const taxonomy = await parseWorkshopTaxonomyFields(formData, domainId);
    const sessionStartsAt = parseRequiredDateTimeLocal(formData, "session_starts_at");
    const sessionEndsAt = parseRequiredDateTimeLocal(formData, "session_ends_at");

    if (!WORKSHOP_FORMATS.has(formatType)) {
      fail("/dashboard/workshops", "Ongeldige workshopvorm.");
    }
    if (!WORKSHOP_DIFFICULTY.has(difficultyLevel)) {
      fail("/dashboard/workshops", "Ongeldig niveau.");
    }
    if (new Date(sessionEndsAt).getTime() <= new Date(sessionStartsAt).getTime()) {
      fail("/dashboard/workshops", "Eindtijd moet na de starttijd liggen.");
    }

    const isActive = !!formData.get("is_active");
    await assertCanPublishListing(canPublish, isActive, "/dashboard/workshops");
    const capacity = parseOptionalInt(formData, "capacity");
    const enforced = await enforceWorkshopBookingFields(
      creator.id,
      creator.creator_types ?? [],
      {
        booking_mode: "request",
        booking_url: null,
        is_active: isActive,
      }
    );
    if (enforced.error) {
      fail("/dashboard/workshops", enforced.error);
    }

    const slug = await ensureUniqueSlug("workshops", title);
    const featuredImageUrl = await resolveProductImageUrl(formData, {
      fileField: "featured_image_file",
      urlField: "featured_image_file_uploaded_url",
      pathPrefix: `creators/${creator.id}/workshops`,
    });
    const galleryUrls = parseGalleryImageUrls(formData);

    const supabase = createPlatformClient();

    const { data: createdWorkshop, error } = await supabase
      .from("workshops")
      .insert({
        creator_id: creator.id,
        domain_id: domainId,
        category_id: taxonomy.category_id,
        slug,
        title,
        short_description: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        featured_image_url: featuredImageUrl,
        format_type: formatType,
        difficulty_level: difficultyLevel,
        offer_type: taxonomy.offer_type,
        audience_types: taxonomy.audience_types,
        age_groups: taxonomy.age_groups,
        languages: taxonomy.languages,
        booking_mode: "request",
        booking_url: null,
        city: parseOptionalString(formData, "city"),
        location_name: parseOptionalString(formData, "location_name"),
        duration_minutes: parseOptionalInt(formData, "duration_minutes"),
        capacity,
        price_cents: parseOptionalEuroToCents(formData, "price_euro") ?? 0,
        currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
        is_active: isActive,
      })
      .select("id, slug")
      .single();

    if (error || !createdWorkshop) {
      fail("/dashboard/workshops", "Workshop aanmaken mislukt.");
    }

    const { error: sessionError } = await supabase.from("workshop_sessions").insert({
      workshop_id: createdWorkshop.id,
      starts_at: sessionStartsAt,
      ends_at: sessionEndsAt,
      capacity,
      remaining_spots: capacity,
      is_cancelled: false,
      booking_status: "open",
    });

    if (sessionError) {
      console.error("Workshop session insert failed:", sessionError);
      fail(
        "/dashboard/workshops",
        "Workshop aangemaakt, maar de datum kon niet worden opgeslagen. Voeg een datum toe via bewerken."
      );
    }

    if (galleryUrls.length > 0) {
      const { error: galleryError } = await supabase
        .from("workshop_gallery_images")
        .insert(
          galleryUrls.map((image_url, index) => ({
            workshop_id: createdWorkshop.id,
            image_url,
            sort_order: index,
          }))
        );
      if (galleryError) {
        console.error("Workshop gallery insert failed:", galleryError);
      }
    }

    if (optionalProductId) {
      const { data: productRow } = await supabase
        .from("products")
        .select("product_type, creator_id")
        .eq("id", optionalProductId)
        .maybeSingle();

      const ownsProduct = productRow?.creator_id === creator.id;
      const isMaterialProduct =
        productRow &&
        ["supply", "workshop_kit", "supplies"].includes(productRow.product_type);

      if (ownsProduct || isMaterialProduct) {
        await supabase.from("workshop_required_products").upsert(
          {
            workshop_id: createdWorkshop.id,
            product_id: optionalProductId,
            is_required: !!formData.get("is_required"),
            sort_order: 0,
          },
          { onConflict: "workshop_id,product_id" }
        );
      }
    }

    revalidatePath("/dashboard/workshops");
    revalidatePath(`/workshop/${createdWorkshop.slug}`);
    const onboardingNext = formData.get("onboarding_next")?.toString();
    if (onboardingNext?.startsWith("/") && !onboardingNext.startsWith("//")) {
      ok(onboardingNext, "Workshop opgeslagen als concept.");
    }
    ok("/dashboard/workshops", isActive ? "Workshop aangemaakt." : "Workshop opgeslagen als concept.");
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
    const { creator, canPublish } = await getRequiredDraftCreator("workshop_host");
    const workshopId = parseRequiredString(formData, "id");
    const title = parseRequiredString(formData, "title");
    const formatType = parseRequiredString(formData, "format_type");
    const difficultyLevel = parseRequiredString(formData, "difficulty_level");
    const domainId = parseOptionalUuid(formData, "domain_id");
    const taxonomy = await parseWorkshopTaxonomyFields(formData, domainId);

    if (!WORKSHOP_FORMATS.has(formatType)) {
      fail("/dashboard/workshops", "Ongeldige workshopvorm.");
    }
    if (!WORKSHOP_DIFFICULTY.has(difficultyLevel)) {
      fail("/dashboard/workshops", "Ongeldig niveau.");
    }

    const isActive = !!formData.get("is_active");
    await assertCanPublishListing(canPublish, isActive, "/dashboard/workshops");
    const enforced = await enforceWorkshopBookingFields(
      creator.id,
      creator.creator_types ?? [],
      {
        booking_mode: "request",
        booking_url: null,
        is_active: isActive,
        excludeWorkshopId: workshopId,
      }
    );
    if (enforced.error) {
      fail("/dashboard/workshops", enforced.error);
    }

    const supabase = createPlatformClient();
    const { data: existingWorkshop, error: existingError } = await supabase
      .from("workshops")
      .select("slug, featured_image_url")
      .eq("id", workshopId)
      .eq("creator_id", creator.id)
      .maybeSingle();

    if (existingError || !existingWorkshop) {
      fail("/dashboard/workshops", "Workshop niet gevonden.");
    }

    const featuredImageUrl = await resolveProductImageUrl(formData, {
      fileField: "featured_image_file",
      urlField: "featured_image_file_uploaded_url",
      existingUrl: existingWorkshop.featured_image_url,
      pathPrefix: `creators/${creator.id}/workshops`,
    });

    const existingGalleryCount = await countGalleryImages(
      "workshop_gallery_images",
      "workshop_id",
      workshopId
    );
    const galleryUrls = parseGalleryImageUrls(
      formData,
      Math.max(0, MAX_GALLERY_IMAGES - existingGalleryCount)
    );

    const { error } = await supabase
      .from("workshops")
      .update({
        slug: existingWorkshop.slug,
        title,
        domain_id: domainId,
        category_id: taxonomy.category_id,
        short_description: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        featured_image_url: featuredImageUrl,
        format_type: formatType,
        difficulty_level: difficultyLevel,
        offer_type: taxonomy.offer_type,
        audience_types: taxonomy.audience_types,
        age_groups: taxonomy.age_groups,
        languages: taxonomy.languages,
        booking_mode: "request",
        booking_url: null,
        city: parseOptionalString(formData, "city"),
        location_name: parseOptionalString(formData, "location_name"),
        duration_minutes: parseOptionalInt(formData, "duration_minutes"),
        capacity: parseOptionalInt(formData, "capacity"),
        price_cents: parseOptionalEuroToCents(formData, "price_euro") ?? 0,
        currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
        is_active: isActive,
      })
      .eq("id", workshopId)
      .eq("creator_id", creator.id);
    if (error) {
      fail("/dashboard/workshops", "Workshop bijwerken mislukt.");
    }

    if (galleryUrls.length > 0) {
      await supabase.from("workshop_gallery_images").insert(
        galleryUrls.map((image_url, index) => ({
          workshop_id: workshopId,
          image_url,
          sort_order: existingGalleryCount + index,
        }))
      );
    }

    revalidatePath("/dashboard/workshops");
    revalidatePath(`/workshop/${existingWorkshop.slug}`);
    ok("/dashboard/workshops", "Workshop bijgewerkt.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/workshops",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createWorkshopSessionAction(
  formData: FormData
): Promise<void> {
  try {
    const { creator } = await getRequiredDraftCreator("workshop_host");
    const workshopId = parseRequiredUuid(formData, "workshop_id");
    const sessionStartsAt = parseRequiredDateTimeLocal(
      formData,
      "session_starts_at"
    );
    const sessionEndsAt = parseRequiredDateTimeLocal(
      formData,
      "session_ends_at"
    );

    if (new Date(sessionEndsAt).getTime() <= new Date(sessionStartsAt).getTime()) {
      fail("/dashboard/workshops", "Eindtijd moet na de starttijd liggen.");
    }

    const supabase = createPlatformClient();
    const { data: workshop, error: workshopError } = await supabase
      .from("workshops")
      .select("id, slug, capacity")
      .eq("id", workshopId)
      .eq("creator_id", creator.id)
      .maybeSingle();

    if (workshopError || !workshop) {
      fail("/dashboard/workshops", "Workshop niet gevonden.");
    }

    const capacity =
      parseOptionalInt(formData, "capacity") ?? workshop.capacity ?? null;

    const { error } = await supabase.from("workshop_sessions").insert({
      workshop_id: workshop.id,
      starts_at: sessionStartsAt,
      ends_at: sessionEndsAt,
      capacity,
      remaining_spots: capacity,
      is_cancelled: false,
      booking_status: "open",
    });

    if (error) {
      fail("/dashboard/workshops", "Datum toevoegen mislukt.");
    }

    revalidatePath("/dashboard/workshops");
    revalidatePath(`/workshop/${workshop.slug}`);
    ok("/dashboard/workshops", "Datum toegevoegd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/workshops",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function cancelWorkshopSessionAction(
  formData: FormData
): Promise<void> {
  try {
    const { creator } = await getRequiredDraftCreator("workshop_host");
    const sessionId = parseRequiredUuid(formData, "session_id");
    const supabase = createPlatformClient();

    const { data: row } = await supabase
      .from("workshop_sessions")
      .select("id, workshop_id, workshops!inner(creator_id, slug)")
      .eq("id", sessionId)
      .maybeSingle();

    const workshop = row?.workshops as
      | { creator_id?: string; slug?: string }
      | { creator_id?: string; slug?: string }[]
      | null
      | undefined;
    const workshopMeta = Array.isArray(workshop) ? workshop[0] : workshop;

    if (!row || workshopMeta?.creator_id !== creator.id) {
      fail("/dashboard/workshops", "Sessie niet gevonden.");
    }

    const { error } = await supabase
      .from("workshop_sessions")
      .update({
        is_cancelled: true,
        booking_status: "closed",
      })
      .eq("id", sessionId);

    if (error) {
      fail("/dashboard/workshops", "Datum annuleren mislukt.");
    }

    revalidatePath("/dashboard/workshops");
    if (workshopMeta?.slug) {
      revalidatePath(`/workshop/${workshopMeta.slug}`);
    }
    ok("/dashboard/workshops", "Datum geannuleerd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/workshops",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteWorkshopGalleryImageAction(
  formData: FormData
): Promise<void> {
  try {
    const { creator } = await getRequiredDraftCreator("workshop_host");
    const galleryImageId = parseRequiredUuid(formData, "gallery_image_id");
    const supabase = createPlatformClient();

    const { data: row } = await supabase
      .from("workshop_gallery_images")
      .select("id, workshop_id, workshops!inner(creator_id, slug)")
      .eq("id", galleryImageId)
      .maybeSingle();

    const workshop = row?.workshops as
      | { creator_id?: string; slug?: string }
      | { creator_id?: string; slug?: string }[]
      | null
      | undefined;
    const workshopMeta = Array.isArray(workshop) ? workshop[0] : workshop;

    if (!row || workshopMeta?.creator_id !== creator.id) {
      fail("/dashboard/workshops", "Foto niet gevonden.");
    }

    const { error } = await supabase
      .from("workshop_gallery_images")
      .delete()
      .eq("id", galleryImageId);

    if (error) {
      fail("/dashboard/workshops", "Foto verwijderen mislukt.");
    }

    revalidatePath("/dashboard/workshops");
    if (workshopMeta?.slug) {
      revalidatePath(`/workshop/${workshopMeta.slug}`);
    }
    ok("/dashboard/workshops", "Foto verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/workshops",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteProductGalleryImageAction(
  formData: FormData
): Promise<void> {
  try {
    const { creator } = await getRequiredCreatorProfile();
    const galleryImageId = parseRequiredUuid(formData, "gallery_image_id");
    const supabase = createPlatformClient();

    const { data: row } = await supabase
      .from("product_gallery_images")
      .select("id, product_id, products!inner(creator_id, slug)")
      .eq("id", galleryImageId)
      .maybeSingle();

    const product = row?.products as
      | { creator_id?: string; slug?: string }
      | { creator_id?: string; slug?: string }[]
      | null
      | undefined;
    const productMeta = Array.isArray(product) ? product[0] : product;

    if (!row || productMeta?.creator_id !== creator.id) {
      fail("/dashboard/products", "Foto niet gevonden.");
    }

    const { error } = await supabase
      .from("product_gallery_images")
      .delete()
      .eq("id", galleryImageId);

    if (error) {
      fail("/dashboard/products", "Foto verwijderen mislukt.");
    }

    revalidatePath("/dashboard/products");
    if (productMeta?.slug) {
      revalidatePath(`/product/${productMeta.slug}`);
      revalidatePath(`/creator/${creator.slug}`);
    }
    ok("/dashboard/products", "Foto verwijderd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/products",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function createEventAction(formData: FormData): Promise<void> {
  try {
    const { creator, canPublish } = await getRequiredDraftCreator("organizer");
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

    const isActive = !!formData.get("is_active");
    await assertCanPublishListing(canPublish, isActive, "/dashboard/events");
    const creditCheck = await enforceEventPublishCredits(
      creator.id,
      eventType,
      isActive,
      false
    );
    if (!creditCheck.ok) {
      fail("/dashboard/events", creditCheck.error ?? "Publiceren mislukt.");
    }

    const enforcedTicketing = await enforceEventTicketingFields(
      creator.id,
      creator.creator_types ?? [],
      null,
      {
        ticketing_mode: ticketingMode,
        ticket_url: null,
      }
    );

    const slug = await ensureUniqueSlug("events", title);
    const featuredImageUrl = await resolveProductImageUrl(formData, {
      fileField: "featured_image_file",
      urlField: "featured_image_file_uploaded_url",
      pathPrefix: `creators/${creator.id}/events`,
    });
    const galleryUrls = parseGalleryImageUrls(formData);
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
      ticket_price_cents: parseOptionalEuroToCents(formData, "ticket_price_euro"),
      currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
      featured_image_url: featuredImageUrl,
      is_active: isActive,
    })
      .select("id, slug")
      .single();

    if (error || !createdEvent?.id) {
      fail("/dashboard/events", "Event aanmaken mislukt.");
    }

    await attachDefaultEventPlan(createdEvent.id as string);

    if (galleryUrls.length > 0) {
      const { error: galleryError } = await supabase
        .from("event_gallery_images")
        .insert(
          galleryUrls.map((image_url, index) => ({
            event_id: createdEvent.id,
            image_url,
            sort_order: index,
          }))
        );
      if (galleryError) {
        console.error("Event gallery insert failed:", galleryError);
      }
    }

    revalidatePath("/dashboard/events");
    if (createdEvent.slug) {
      revalidatePath(`/agenda/${createdEvent.slug}`);
      revalidatePath(`/event/${createdEvent.slug}`);
    }
    const onboardingNext = formData.get("onboarding_next")?.toString();
    if (onboardingNext?.startsWith("/") && !onboardingNext.startsWith("//")) {
      ok(onboardingNext, "Evenement opgeslagen als concept.");
    }
    ok(
      "/dashboard/events",
      isActive ? "Event aangemaakt." : "Event opgeslagen als concept."
    );
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
    const { creator, canPublish } = await getRequiredDraftCreator("organizer");
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
        ticket_url: null,
      }
    );

    const supabase = createPlatformClient();
    const { data: existingEvent, error: existingError } = await supabase
      .from("events")
      .select("slug, featured_image_url, is_active")
      .eq("id", eventId)
      .eq("organizer_creator_id", creator.id)
      .maybeSingle();

    if (existingError || !existingEvent) {
      fail("/dashboard/events", "Event niet gevonden.");
    }

    // Charge on the draft -> active transition, mirroring
    // updateProductAction. Without this, publishing via "create as draft,
    // then edit to active" would bypass the event publish fee entirely.
    const isActive = !!formData.get("is_active");
    await assertCanPublishListing(canPublish, isActive, "/dashboard/events");
    if (isActive && !existingEvent.is_active) {
      const creditCheck = await enforceEventPublishCredits(
        creator.id,
        eventType,
        true,
        false
      );
      if (!creditCheck.ok) {
        fail("/dashboard/events", creditCheck.error ?? "Publiceren mislukt.");
      }
    }

    const featuredImageUrl = await resolveProductImageUrl(formData, {
      fileField: "featured_image_file",
      urlField: "featured_image_file_uploaded_url",
      existingUrl: existingEvent.featured_image_url,
      pathPrefix: `creators/${creator.id}/events`,
    });
    const existingGalleryCount = await countGalleryImages(
      "event_gallery_images",
      "event_id",
      eventId
    );
    const galleryUrls = parseGalleryImageUrls(
      formData,
      Math.max(0, MAX_GALLERY_IMAGES - existingGalleryCount)
    );

    const { error } = await supabase
      .from("events")
      .update({
        slug: existingEvent.slug,
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
        ticket_price_cents: parseOptionalEuroToCents(formData, "ticket_price_euro"),
        currency_code: parseOptionalString(formData, "currency_code") ?? "EUR",
        featured_image_url: featuredImageUrl,
        is_active: isActive,
      })
      .eq("id", eventId)
      .eq("organizer_creator_id", creator.id);

    if (error) {
      fail("/dashboard/events", "Event bijwerken mislukt.");
    }

    if (galleryUrls.length > 0) {
      await supabase.from("event_gallery_images").insert(
        galleryUrls.map((image_url, index) => ({
          event_id: eventId,
          image_url,
          sort_order: existingGalleryCount + index,
        }))
      );
    }

    revalidatePath("/dashboard/events");
    revalidatePath(`/agenda/${existingEvent.slug}`);
    revalidatePath(`/event/${existingEvent.slug}`);
    ok("/dashboard/events", "Event bijgewerkt.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/events",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

export async function deleteEventGalleryImageAction(
  formData: FormData
): Promise<void> {
  try {
    const { creator } = await getRequiredDraftCreator("organizer");
    const galleryImageId = parseRequiredUuid(formData, "gallery_image_id");
    const supabase = createPlatformClient();

    const { data: row } = await supabase
      .from("event_gallery_images")
      .select("id, event_id, events!inner(organizer_creator_id, slug)")
      .eq("id", galleryImageId)
      .maybeSingle();

    const event = row?.events as
      | { organizer_creator_id?: string; slug?: string }
      | { organizer_creator_id?: string; slug?: string }[]
      | null
      | undefined;
    const eventMeta = Array.isArray(event) ? event[0] : event;

    if (!row || eventMeta?.organizer_creator_id !== creator.id) {
      fail("/dashboard/events", "Foto niet gevonden.");
    }

    const { error } = await supabase
      .from("event_gallery_images")
      .delete()
      .eq("id", galleryImageId);

    if (error) {
      fail("/dashboard/events", "Foto verwijderen mislukt.");
    }

    revalidatePath("/dashboard/events");
    if (eventMeta?.slug) {
      revalidatePath(`/agenda/${eventMeta.slug}`);
      revalidatePath(`/event/${eventMeta.slug}`);
    }
    ok("/dashboard/events", "Foto verwijderd.");
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
    const { creator } = await getRequiredCreatorProfile();
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
    const { creator } = await getRequiredCreatorProfile();
    const workshopId = parseRequiredUuid(formData, "workshop_id");
    const productId = parseOptionalUuid(formData, "product_id");
    if (!productId) {
      fail(
        "/dashboard/workshops",
        "Kies een materiaal om te koppelen, of sla deze stap over."
      );
    }
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
    const { creator } = await getRequiredCreatorProfile();
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
    const { creator } = await getRequiredCreatorProfile();
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
      fail(CREATOR_MAKER_PATH, result.error ?? "Spotlight aankoop mislukt.");
    }

    revalidatePath("/profile");
    ok(CREATOR_MAKER_PATH, "Spotlight geactiveerd.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      CREATOR_MAKER_PATH,
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}

/**
 * Moderator-only manual credit correction (refunds, goodwill, support
 * cases). Real credit purchases go through Stripe Checkout
 * (createCreditPackCheckoutAction) and are granted by the webhook - this
 * action must never be reachable from a creator's own dashboard, and never
 * uses reason "purchase" so the audit trail can't be confused with a real
 * payment.
 */
export async function addListingCreditsAction(formData: FormData): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      fail("/dashboard/products", "Meld je eerst aan.");
    }
    if (!(await isModerator(user.id))) {
      fail("/dashboard/products", "Alleen moderators kunnen credits handmatig toekennen.");
    }

    const targetCreatorId = parseRequiredString(formData, "creator_id");
    const packCode = parseRequiredString(formData, "pack_code");
    const note = parseOptionalString(formData, "note");

    const targetCreator = await getCreatorById(targetCreatorId);
    if (!targetCreator) {
      fail("/dashboard/products", "Creator niet gevonden.");
    }

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

    const result = await addCredits(targetCreatorId, pack.credits, "manual_adjustment", {
      pack_code: packCode,
      granted_by_user_id: user.id,
      note: note ?? undefined,
    });

    if (!result.ok) {
      fail("/dashboard/products", result.error ?? "Credits toevoegen mislukt.");
    }

    revalidatePath("/dashboard/products");
    ok(
      "/dashboard/products",
      `${pack.credits} credits handmatig toegekend aan ${targetCreator.display_name} (${pack.name}).`
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/products",
      error instanceof Error ? error.message : "Onbekende fout."
    );
  }
}
