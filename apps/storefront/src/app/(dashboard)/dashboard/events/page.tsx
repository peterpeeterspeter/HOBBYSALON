import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { createEventAction, updateEventAction, deleteEventAction, deleteEventGalleryImageAction } from "@/app/actions/dashboard";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { updateEventVendorInquiryStatusAction } from "@/app/actions/event-vendor-inquiry";
import { sendExhibitorOutreachAction } from "@/app/actions/exhibitor-outreach";
import { getDashboardCommercialContext } from "@/lib/platform/commercial-enforcement";
import { isCommercialGatingEnabled } from "@/lib/platform/commercial-entitlements";
import { LISTING_CREDIT_COSTS, getEventCreditCost } from "@/lib/platform/listing-credits";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { MultiImageUploadField } from "@/components/ui/multi-image-upload-field";
import type { Event } from "@/types/platform";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

type GalleryImage = {
  id: string;
  event_id: string;
  image_url: string;
  sort_order: number;
};

const EVENT_TYPES = [
  { value: "handmade_market", label: "Handmade markt" },
  { value: "hobby_fair", label: "Hobbybeurs" },
  { value: "pop_up", label: "Pop-up" },
  { value: "open_atelier", label: "Open atelier" },
  { value: "workshop_day", label: "Workshopdag" },
];

const TICKETING_MODES = [
  { value: "none", label: "Geen tickets" },
  { value: "external_link", label: "Externe ticketlink (Premium)" },
];

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatEuroFromCents(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export default async function DashboardEventsPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/events");
  }

  const [creator, registrationContext] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
  ]);
  const caps = resolveDashboardCapabilities({
    registrationContext,
    creatorTypes: creator?.creator_types,
    hasCreatorProfile: Boolean(creator),
  });
  requireDashboardCapability(caps.canDraftEvents);

  const { success, error } = await searchParams;

  let events: Event[] = [];
  let vendorInquiries: Array<{
    id: string;
    event_id: string;
    business_name: string;
    contact_name: string;
    email: string;
    message: string | null;
    status: string;
    created_at: string;
  }> = [];
  const standhoudersByEvent = new Map<
    string,
    Array<{ creator_id: string; display_name: string; slug: string }>
  >();
  const galleryByEvent = new Map<string, GalleryImage[]>();
  let commercialContext: Awaited<ReturnType<typeof getDashboardCommercialContext>> | null =
    null;

  if (creator) {
    const supabase = createPlatformClient();
    commercialContext = await getDashboardCommercialContext(
      creator.id,
      creator.creator_types ?? []
    );
    const [eventsResult, inquiriesResult] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .eq("organizer_creator_id", creator.id)
        .order("starts_at", { ascending: true }),
      supabase
        .from("event_vendor_inquiries")
        .select("*")
        .eq("organizer_creator_id", creator.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    events = (eventsResult.data ?? []) as Event[];
    vendorInquiries = inquiriesResult.data ?? [];

    const eventIds = events.map((event) => event.id);
    if (eventIds.length > 0) {
      const [{ data: rosterRows }, { data: galleryData }] = await Promise.all([
        supabase
          .from("event_creators")
          .select("event_id, creator_id, role, creators(display_name, slug)")
          .in("event_id", eventIds)
          .eq("role", "vendor"),
        supabase
          .from("event_gallery_images")
          .select("id, event_id, image_url, sort_order")
          .in("event_id", eventIds)
          .order("sort_order", { ascending: true }),
      ]);

      for (const row of (rosterRows ?? []) as Array<{
        event_id: string;
        creator_id: string;
        creators:
          | { display_name: string; slug: string }
          | { display_name: string; slug: string }[]
          | null;
      }>) {
        const creatorMeta = Array.isArray(row.creators)
          ? row.creators[0]
          : row.creators;
        if (!creatorMeta) continue;
        const list = standhoudersByEvent.get(row.event_id) ?? [];
        list.push({
          creator_id: row.creator_id,
          display_name: creatorMeta.display_name,
          slug: creatorMeta.slug,
        });
        standhoudersByEvent.set(row.event_id, list);
      }

      for (const image of (galleryData ?? []) as GalleryImage[]) {
        const list = galleryByEvent.get(image.event_id) ?? [];
        list.push(image);
        galleryByEvent.set(image.event_id, list);
      }
    }
  }

  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() + 7);
  defaultStart.setHours(10, 0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(defaultEnd.getHours() + 6);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Eventbeheer</h1>
      <p className="text-[var(--muted)]">Publiceer en beheer je events in de agenda.</p>

      {success && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!creator ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Maak eerst een creator-profiel aan om events te beheren.
        </p>
      ) : (
        <>
          <CardShell variant="default" padding="lg">
          <form action={createEventAction} encType="multipart/form-data">
            <h2 className="text-lg font-semibold">Nieuw event</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-medium">Titel *</span>
                <input name="title" required className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Type *</span>
                <select name="event_type" defaultValue="handmade_market" className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                  {EVENT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                      {isCommercialGatingEnabled()
                        ? ` (${getEventCreditCost(option.value)} credits)`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Ticketing *</span>
                <select name="ticketing_mode" defaultValue="none" className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                  {TICKETING_MODES.filter(
                    (option) =>
                      option.value !== "external_link" ||
                      commercialContext?.allowExternalLinks
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Start *</span>
                <input
                  type="datetime-local"
                  name="starts_at"
                  required
                  defaultValue={toDateTimeLocal(defaultStart.toISOString())}
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Einde *</span>
                <input
                  type="datetime-local"
                  name="ends_at"
                  required
                  defaultValue={toDateTimeLocal(defaultEnd.toISOString())}
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Locatie of zaal</span>
                <input name="location_name" placeholder="bijv. Schaliken" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Stad</span>
                <input name="city" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Adres</span>
                <input name="address_line_1" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Postcode</span>
                <input name="postal_code" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Ticketprijs (€)</span>
                <input
                  name="ticket_price_euro"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0,00"
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                />
              </label>
              <div className="sm:col-span-2">
                <ImageUploadField
                  name="featured_image_file"
                  label="Hoofdfoto"
                  uploadPathPrefix={`creators/${creator.id}/events`}
                  hint="Deze foto verschijnt als eerste in de agenda."
                />
              </div>
              <div className="sm:col-span-2">
                <MultiImageUploadField
                  uploadPathPrefix={`creators/${creator.id}/events/gallery`}
                  label="Extra foto's"
                  hint="Optioneel. Voeg meerdere foto's toe van de locatie, stands of sfeer."
                />
              </div>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-medium">Korte omschrijving</span>
                <input name="short_description" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-medium">Omschrijving</span>
                <textarea name="description" rows={3} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="is_active" />
                <span className="text-sm">Actief publiceren</span>
              </label>
            </div>
            <Button type="submit" className="mt-4">
              Event aanmaken
            </Button>
          </form>
          </CardShell>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Events ({events.length})</h2>
            {events.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-sm text-[var(--muted)]">
                Nog geen events.
              </p>
            ) : (
              events.map((event) => {
                const gallery = galleryByEvent.get(event.id) ?? [];
                return (
                <details key={event.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                  <summary className="cursor-pointer list-none font-medium">
                    {event.title}{" "}
                    <span className="text-sm text-[var(--muted)]">
                      ({event.event_type}){event.is_active ? " · actief" : " · concept"}
                    </span>
                  </summary>
                  {gallery.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">
                        Extra foto&apos;s ({gallery.length})
                      </p>
                      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {gallery.map((image) => (
                          <li key={image.id} className="space-y-1">
                            <img
                              src={image.image_url}
                              alt=""
                              className="aspect-square w-full rounded-lg border border-[var(--border)] object-cover"
                            />
                            <form action={deleteEventGalleryImageAction}>
                              <input
                                type="hidden"
                                name="gallery_image_id"
                                value={image.id}
                              />
                              <button
                                type="submit"
                                className="text-xs text-red-700 hover:underline"
                              >
                                Verwijder
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <form action={updateEventAction} encType="multipart/form-data" className="mt-4 grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="id" value={event.id} />
                    <label className="sm:col-span-2">
                      <span className="mb-1 block text-sm font-medium">Titel *</span>
                      <input name="title" required defaultValue={event.title} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Type *</span>
                      <select name="event_type" defaultValue={event.event_type} className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                        {EVENT_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                            {isCommercialGatingEnabled() && !event.is_active
                              ? ` (${getEventCreditCost(option.value)} credits)`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Ticketing *</span>
                      <select name="ticketing_mode" defaultValue={event.ticketing_mode} className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                        {TICKETING_MODES.filter(
                    (option) =>
                      option.value !== "external_link" ||
                      commercialContext?.allowExternalLinks
                  ).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Start *</span>
                      <input
                        type="datetime-local"
                        name="starts_at"
                        required
                        defaultValue={toDateTimeLocal(event.starts_at)}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Einde *</span>
                      <input
                        type="datetime-local"
                        name="ends_at"
                        required
                        defaultValue={toDateTimeLocal(event.ends_at)}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Locatie of zaal</span>
                      <input name="location_name" defaultValue={event.location_name ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Stad</span>
                      <input name="city" defaultValue={event.city ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Adres</span>
                      <input name="address_line_1" defaultValue={event.address_line_1 ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Postcode</span>
                      <input name="postal_code" defaultValue={event.postal_code ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Ticketprijs (€)</span>
                      <input
                        name="ticket_price_euro"
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={formatEuroFromCents(event.ticket_price_cents)}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <ImageUploadField
                        name="featured_image_file"
                        label="Hoofdfoto"
                        currentUrl={event.featured_image_url}
                        uploadPathPrefix={`creators/${creator.id}/events`}
                        hint="Laat leeg om de huidige foto te behouden."
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-3">
                      <MultiImageUploadField
                        uploadPathPrefix={`creators/${creator.id}/events/gallery`}
                        label="Extra foto's toevoegen"
                        existingCount={gallery.length}
                        hint="Worden bewaard wanneer je Opslaan klikt. Vierkant · min. 1000×1000 px."
                      />
                    </div>
                    <label className="sm:col-span-2">
                      <span className="mb-1 block text-sm font-medium">Korte omschrijving</span>
                      <input name="short_description" defaultValue={event.short_description ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-1 block text-sm font-medium">Omschrijving</span>
                      <textarea name="description" rows={3} defaultValue={event.description ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" name="is_active" defaultChecked={event.is_active} />
                      <span className="text-sm">Actief</span>
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button type="submit" className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]">
                        Opslaan
                      </button>
                      <ConfirmSubmitButton
                        variant="danger"
                        size="sm"
                        formAction={deleteEventAction}
                        formNoValidate
                        message={
                          event.is_active
                            ? "Dit evenement verdwijnt van de site. Doorgaan?"
                            : "Dit concept definitief verwijderen?"
                        }
                      >
                        {event.is_active ? "Evenement verwijderen" : "Verwijder concept"}
                      </ConfirmSubmitButton>
                    </div>
                  </form>

                  {(() => {
                    const standhouders = standhoudersByEvent.get(event.id) ?? [];
                    return (
                      <div className="mt-4 border-t border-[var(--border)] pt-4">
                        <h3 className="text-sm font-semibold">
                          Bevestigde standhouders ({standhouders.length})
                        </h3>
                        {standhouders.length === 0 ? (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Nog geen RSVP’s. Makers en workshopgevers bevestigen
                            zichzelf op de eventpagina.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-1 text-sm">
                            {standhouders.map((standhouder) => (
                              <li key={standhouder.creator_id}>
                                <Link
                                  href={`/creator/${standhouder.slug}`}
                                  className="font-medium text-[var(--accent)] hover:underline"
                                >
                                  {standhouder.display_name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}

                  <form
                    action={sendExhibitorOutreachAction}
                    className="mt-4 border-t border-[var(--border)] pt-4"
                  >
                    <input type="hidden" name="event_id" value={event.id} />
                    <h3 className="text-sm font-semibold">
                      Standhouders werven
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Stuur een oproep naar makers die aangaven open te staan
                      voor markten en beurzen.
                      {isCommercialGatingEnabled()
                        ? ` Kost ${LISTING_CREDIT_COSTS.exhibitorOutreach} credits.`
                        : " Momenteel gratis."}
                    </p>
                    <textarea
                      name="message"
                      rows={2}
                      placeholder="Korte boodschap voor makers (optioneel)"
                      className="mt-2 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="mt-2 rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]"
                    >
                      Oproep versturen
                    </button>
                  </form>
                </details>
                );
              })
            )}
          </div>

          <CardShell variant="default" padding="lg" className="mt-8">
            <h2 className="text-lg font-semibold">Standhouder-aanvragen</h2>
            {vendorInquiries.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Nog geen standhouder-aanvragen ontvangen.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {vendorInquiries.map((inquiry) => {
                  const isNew = inquiry.status === "new";
                  return (
                    <li
                      key={inquiry.id}
                      className={`rounded-lg border p-4 ${
                        isNew
                          ? "border-amber-300 bg-amber-50/60"
                          : "border-[var(--border)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{inquiry.business_name}</p>
                        {isNew ? (
                          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            Nieuw
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {inquiry.contact_name} · {inquiry.email}
                      </p>
                      {inquiry.message && (
                        <p className="mt-2 text-sm">{inquiry.message}</p>
                      )}
                      <form
                        className="mt-3 flex items-center gap-2"
                        action={async (formData: FormData) => {
                          "use server";
                          if (!creator) return;
                          await updateEventVendorInquiryStatusAction({
                            inquiryId: inquiry.id,
                            organizerCreatorId: creator.id,
                            status: formData.get("status") as
                              | "new"
                              | "contacted"
                              | "accepted"
                              | "declined",
                          });
                        }}
                      >
                        <select
                          name="status"
                          defaultValue={inquiry.status}
                          className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                        >
                          <option value="new">Nieuw</option>
                          <option value="contacted">Gecontacteerd</option>
                          <option value="accepted">Geaccepteerd</option>
                          <option value="declined">Afgewezen</option>
                        </select>
                        <Button type="submit" variant="secondary">
                          Status opslaan
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardShell>
        </>
      )}
    </section>
  );
}
