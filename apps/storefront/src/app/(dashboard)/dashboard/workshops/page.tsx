import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import {
  createWorkshopAction,
  updateBookingRequestStatusAction,
  updateWorkshopAction,
  linkWorkshopProductAction,
  unlinkWorkshopProductAction,
} from "@/app/actions/dashboard";
import { getDashboardCommercialContext } from "@/lib/platform/commercial-enforcement";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import type { Workshop } from "@/types/platform";

type BookingRequest = {
  id: string;
  workshop_id: string;
  full_name: string;
  email: string;
  message: string | null;
  status: string;
  created_at: string;
  workshops?: { title: string }[] | null;
};

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const FORMAT_OPTIONS = [
  { value: "physical", label: "Fysiek" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybride" },
];

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Gevorderd" },
  { value: "advanced", label: "Expert" },
];

const BOOKING_MODE_OPTIONS = [
  { value: "request", label: "Aanvraag via Hobbysalon" },
  { value: "external_link", label: "Externe link (Premium)" },
];

const REQUEST_STATUS_OPTIONS = [
  { value: "new", label: "Nieuw" },
  { value: "contacted", label: "Gecontacteerd" },
  { value: "confirmed", label: "Bevestigd" },
  { value: "cancelled", label: "Geannuleerd" },
];

export default async function DashboardWorkshopsPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const creator = user ? await getCreatorByUserId(user.id) : null;
  const { success, error } = await searchParams;

  let workshops: Workshop[] = [];
  let bookingRequests: BookingRequest[] = [];
  let commercialContext: Awaited<ReturnType<typeof getDashboardCommercialContext>> | null =
    null;

  if (creator) {
    const supabase = createPlatformClient();
    commercialContext = await getDashboardCommercialContext(
      creator.id,
      creator.creator_types ?? []
    );
    const [workshopsResult, requestsResult] = await Promise.all([
      supabase
        .from("workshops")
        .select("*")
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("workshop_booking_requests")
        .select("id, workshop_id, full_name, email, message, status, created_at, workshops(title)")
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    workshops = (workshopsResult.data ?? []) as Workshop[];
    bookingRequests = (requestsResult.data ?? []) as BookingRequest[];
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Workshopbeheer</h1>
      <p className="text-[var(--muted)]">
        Beheer workshops en behandel boekingsaanvragen.
        {commercialContext?.workshopLimit != null && (
          <>
            {" "}
            Actieve workshops: {commercialContext.activeWorkshopCount}/
            {commercialContext.workshopLimit}
          </>
        )}
      </p>

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
          Maak eerst een creator-profiel aan om workshops te beheren.
        </p>
      ) : (
        <>
          <CardShell variant="default" padding="lg">
          <form action={createWorkshopAction}>
            <h2 className="text-lg font-semibold">Nieuwe workshop</h2>
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
                <span className="mb-1 block text-sm font-medium">Format *</span>
                <select name="format_type" defaultValue="physical" className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Niveau *</span>
                <select name="difficulty_level" defaultValue="beginner" className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Boekingsmode *</span>
                <select name="booking_mode" defaultValue="request" className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                  {BOOKING_MODE_OPTIONS.filter(
                    (option) =>
                      option.value !== "external_link" ||
                      commercialContext?.allowExternalBooking
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Boekings URL</span>
                <input name="booking_url" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
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
                <span className="mb-1 block text-sm font-medium">Prijs (cent)</span>
                <input
                  name="price_cents"
                  type="number"
                  min={0}
                  defaultValue={0}
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Duur (min)</span>
                <input name="duration_minutes" type="number" min={0} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Capaciteit</span>
                <input name="capacity" type="number" min={0} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
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
              Workshop aanmaken
            </Button>
          </form>
          </CardShell>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Workshops ({workshops.length})</h2>
            {workshops.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-sm text-[var(--muted)]">
                Nog geen workshops.
              </p>
            ) : (
              workshops.map((workshop) => (
                <details key={workshop.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                  <summary className="cursor-pointer list-none font-medium">
                    {workshop.title}{" "}
                    <span className="text-sm text-[var(--muted)]">
                      ({workshop.format_type}){workshop.is_active ? " · actief" : " · concept"}
                    </span>
                  </summary>
                  <form action={updateWorkshopAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="id" value={workshop.id} />
                    <label>
                      <span className="mb-1 block text-sm font-medium">Titel *</span>
                      <input name="title" required defaultValue={workshop.title} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Slug</span>
                      <input name="slug" defaultValue={workshop.slug} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Format *</span>
                      <select name="format_type" defaultValue={workshop.format_type} className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                        {FORMAT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Niveau *</span>
                      <select name="difficulty_level" defaultValue={workshop.difficulty_level} className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                        {DIFFICULTY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Boekingsmode *</span>
                      <select name="booking_mode" defaultValue={workshop.booking_mode} className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                        {BOOKING_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Boekings URL</span>
                      <input name="booking_url" defaultValue={workshop.booking_url ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Locatie</span>
                      <input name="location_name" defaultValue={workshop.location_name ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Stad</span>
                      <input name="city" defaultValue={workshop.city ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Prijs (cent)</span>
                      <input name="price_cents" type="number" min={0} defaultValue={workshop.price_cents} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Duur (min)</span>
                      <input name="duration_minutes" type="number" min={0} defaultValue={workshop.duration_minutes ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Capaciteit</span>
                      <input name="capacity" type="number" min={0} defaultValue={workshop.capacity ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label>
                      <span className="mb-1 block text-sm font-medium">Afbeelding URL</span>
                      <input name="featured_image_url" defaultValue={workshop.featured_image_url ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-1 block text-sm font-medium">Korte omschrijving</span>
                      <input name="short_description" defaultValue={workshop.short_description ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-1 block text-sm font-medium">Omschrijving</span>
                      <textarea name="description" rows={3} defaultValue={workshop.description ?? ""} className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" name="is_active" defaultChecked={workshop.is_active} />
                      <span className="text-sm">Actief</span>
                    </label>
                    <div className="sm:col-span-2">
                      <button type="submit" className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]">
                        Opslaan
                      </button>
                    </div>
                  </form>
                  <form action={linkWorkshopProductAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="workshop_id" value={workshop.id} />
                    <label className="sm:col-span-2">
                      <span className="mb-1 block text-sm font-medium">
                        Materiaal/product koppelen (UUID)
                      </span>
                      <input
                        name="product_id"
                        required
                        placeholder="Product-ID uit platform"
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" name="is_required" defaultChecked />
                      <span className="text-sm">Verplicht materiaal</span>
                    </label>
                    <div>
                      <button
                        type="submit"
                        className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]"
                      >
                        Koppelen
                      </button>
                    </div>
                  </form>
                </details>
              ))
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Boekingsaanvragen ({bookingRequests.length})</h2>
            {bookingRequests.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-sm text-[var(--muted)]">
                Nog geen boekingsaanvragen.
              </p>
            ) : (
              bookingRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">
                        {request.full_name} · {request.email}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        Workshop: {request.workshops?.[0]?.title ?? request.workshop_id}
                      </p>
                      {request.message && (
                        <p className="mt-1 text-sm text-[var(--foreground)]">{request.message}</p>
                      )}
                    </div>
                    <form action={updateBookingRequestStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={request.id} />
                      <select
                        name="status"
                        defaultValue={request.status}
                        className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
                      >
                        {REQUEST_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
                      >
                        Update
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
