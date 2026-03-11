"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";

const PRODUCT_TYPES = new Set([
  "supply",
  "handmade",
  "event_listing",
  "event_ticket",
  "workshop_ticket",
  "workshop_kit",
]);

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

  return { user, creator };
}

async function ensureUniqueSlug(
  table: "creators" | "products" | "workshops" | "events",
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

export async function saveCreatorProfileAction(formData: FormData): Promise<void> {
  try {
    const user = await getAuthUser();
    if (!user) {
      fail("/login?next=/dashboard/creator", "Meld je eerst aan.");
    }

    const displayName = parseRequiredString(formData, "display_name");
    const preferredSlug = parseOptionalString(formData, "slug") ?? displayName;
    const slug = await ensureUniqueSlug("creators", preferredSlug);
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

    if (existing) {
      const slugForUpdate =
        preferredSlug && preferredSlug !== existing.slug
          ? await ensureUniqueSlug("creators", preferredSlug, existing.id)
          : existing.slug;

      const { error } = await supabase
        .from("creators")
        .update({ ...payload, slug: slugForUpdate })
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (error) {
        fail("/dashboard/creator", "Opslaan van creator-profiel mislukt.");
      }
    } else {
      const { error } = await supabase.from("creators").insert(payload);
      if (error) {
        fail("/dashboard/creator", "Aanmaken van creator-profiel mislukt.");
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/creator");
    ok("/dashboard/creator", "Creator-profiel opgeslagen.");
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
    const { creator } = await getRequiredCreator();
    const title = parseRequiredString(formData, "title");
    const productType = parseRequiredString(formData, "product_type");

    if (!PRODUCT_TYPES.has(productType)) {
      fail("/dashboard/products", "Ongeldig producttype.");
    }

    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("products", preferredSlug);
    const supabase = createPlatformClient();

    const { error } = await supabase.from("products").insert({
      creator_id: creator.id,
      slug,
      title,
      short_description: parseOptionalString(formData, "short_description"),
      description: parseOptionalString(formData, "description"),
      featured_image_url: parseOptionalString(formData, "featured_image_url"),
      product_type: productType,
      status: formData.get("is_active") ? "active" : "draft",
      is_active: !!formData.get("is_active"),
    });

    if (error) {
      fail("/dashboard/products", "Product aanmaken mislukt.");
    }

    revalidatePath("/dashboard/products");
    ok("/dashboard/products", "Product aangemaakt.");
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
    const { creator } = await getRequiredCreator();
    const productId = parseRequiredString(formData, "id");
    const title = parseRequiredString(formData, "title");
    const productType = parseRequiredString(formData, "product_type");

    if (!PRODUCT_TYPES.has(productType)) {
      fail("/dashboard/products", "Ongeldig producttype.");
    }

    const preferredSlug = parseOptionalString(formData, "slug") ?? title;
    const slug = await ensureUniqueSlug("products", preferredSlug, productId);
    const supabase = createPlatformClient();

    const { error } = await supabase
      .from("products")
      .update({
        slug,
        title,
        short_description: parseOptionalString(formData, "short_description"),
        description: parseOptionalString(formData, "description"),
        featured_image_url: parseOptionalString(formData, "featured_image_url"),
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
    ok("/dashboard/products", "Product bijgewerkt.");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    fail(
      "/dashboard/products",
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
