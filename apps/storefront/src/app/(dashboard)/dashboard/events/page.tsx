import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { createEventAction, updateEventAction } from "@/app/actions/dashboard";
import { updateEventVendorInquiryStatusAction } from "@/app/actions/event-vendor-inquiry";
import { getDashboardCommercialContext } from "@/lib/platform/commercial-enforcement";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import type { Event } from "@/types/platform";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
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
  requireDashboardCapability(caps.canManageEvents);

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
          <form action={createEventAction}>
            <h2 className="text-lg font-semibold">Nieuw event</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-medium">Titel *</span>
                <input name="title" required className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Slug</span>
                <input name="slug" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Type *</span>
                <select name="event_type" defaultValue="handmade_market" className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                  {EVENT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
                <span className="mb-1 block text-sm font-medium">Locatie</span>
                <input name="location_name" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
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
                <span className="mb-1 block text-sm font-medium">Ticket URL</span>
                <input name="ticket_url" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Ticketprijs (cent)</span>
                <input name="ticket_price_cents" type="number" min={0} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Afbeelding URL</span>
                <input name="featured_image_url" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
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
              events.map((event) => (
                <details key={event.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                  <summary className="cursor-pointer list-none font-medium">
                    {event.title}{" "}
                    <span className="text-sm text-[var(--muted)]">
                      ({event.event_type}){event.is_active ? " · actief" : " · concept"}
                    </span>
                  </summary>
                  <form action={updateEventAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="id" value={event.id} />
                    <label>
                      <span className="mb-1 block text-sm font-medium">Titel *</span>
                      <input name="title" required defaultValue={event.title} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Slug</span>
                      <input name="slug" defaultValue={event.slug} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Type *</span>
                      <select name="event_type" defaultValue={event.event_type} className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                        {EVENT_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
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
                      <span className="mb-1 block text-sm font-medium">Locatie</span>
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
                      <span className="mb-1 block text-sm font-medium">Ticket URL</span>
                      <input name="ticket_url" defaultValue={event.ticket_url ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Ticketprijs (cent)</span>
                      <input name="ticket_price_cents" type="number" min={0} defaultValue={event.ticket_price_cents ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Afbeelding URL</span>
                      <input name="featured_image_url" defaultValue={event.featured_image_url ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
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
                    <div className="sm:col-span-2">
                      <button type="submit" className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]">
                        Opslaan
                      </button>
                    </div>
                  </form>
                </details>
              ))
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
                {vendorInquiries.map((inquiry) => (
                  <li
                    key={inquiry.id}
                    className="rounded-lg border border-[var(--border)] p-4"
                  >
                    <p className="font-semibold">{inquiry.business_name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {inquiry.contact_name} · {inquiry.email}
                    </p>
                    {inquiry.message && (
                      <p className="mt-2 text-sm">{inquiry.message}</p>
                    )}
                    <form
                      className="mt-3 flex items-center gap-2"
                      action={async (formData) => {
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
                ))}
              </ul>
            )}
          </CardShell>
        </>
      )}
    </section>
  );
}
