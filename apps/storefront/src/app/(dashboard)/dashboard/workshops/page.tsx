import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import {
  cancelWorkshopSessionAction,
  createWorkshopAction,
  createWorkshopSessionAction,
  deleteWorkshopAction,
  updateBookingRequestStatusAction,
  updateWorkshopAction,
  deleteWorkshopGalleryImageAction,
} from "@/app/actions/dashboard";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { getDashboardCommercialContext } from "@/lib/platform/commercial-enforcement";
import { getWorkshopLaunchDashboardStats } from "@/lib/platform/workshop-listing-fee";
import { createWorkshopListingCheckoutAction } from "@/app/actions/listing-checkout";
import {
  WORKSHOP_FREE_LISTING_CAP,
  WORKSHOP_LAUNCH_COPY,
  isWorkshopListingPubliclyVisible,
} from "@/lib/pricing/workshop-launch-offer";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { MultiImageUploadField } from "@/components/ui/multi-image-upload-field";
import { WorkshopTaxonomyFields } from "@/components/dashboard/WorkshopTaxonomyFields";
import { listWorkshopCategories } from "@/lib/platform/queries/workshop-categories";
import type { Workshop } from "@/types/platform";

type BookingRequest = {
  id: string;
  workshop_id: string;
  full_name: string;
  email: string;
  message: string | null;
  status: string;
  created_at: string;
  workshops?: { title: string } | { title: string }[] | null;
};

type GalleryImage = {
  id: string;
  workshop_id: string;
  image_url: string;
  sort_order: number;
};

type WorkshopSessionRow = {
  id: string;
  workshop_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  remaining_spots: number | null;
  is_cancelled: boolean;
  booking_status: string;
};

type Props = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    checkout?: string;
    type?: string;
  }>;
};

function formatEuroFromCents(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function bookingWorkshopTitle(
  request: BookingRequest,
  workshopTitles: Map<string, string>
): string {
  const joined = request.workshops;
  if (joined) {
    if (Array.isArray(joined) && joined[0]?.title) return joined[0].title;
    if (!Array.isArray(joined) && joined.title) return joined.title;
  }
  return workshopTitles.get(request.workshop_id) ?? "Workshop";
}

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

const REQUEST_STATUS_OPTIONS = [
  { value: "new", label: "Nieuw" },
  { value: "contacted", label: "Gecontacteerd" },
  { value: "confirmed", label: "Bevestigd" },
  { value: "cancelled", label: "Geannuleerd" },
];

export default async function DashboardWorkshopsPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/workshops");
  }

  const [creator, registrationContext, domains, workshopCategories] =
    await Promise.all([
      getCreatorByUserId(user.id),
      getUserRegistrationContext(user.id),
      listDomainsBySort(),
      listWorkshopCategories({ activeOnly: true }),
    ]);
  const caps = resolveDashboardCapabilities({
    registrationContext,
    creatorTypes: creator?.creator_types,
    hasCreatorProfile: Boolean(creator),
  });
  requireDashboardCapability(caps.canDraftWorkshops);

  const { success, error, checkout } = await searchParams;

  let workshops: Workshop[] = [];
  let bookingRequests: BookingRequest[] = [];
  const galleryByWorkshop = new Map<string, GalleryImage[]>();
  const sessionsByWorkshop = new Map<string, WorkshopSessionRow[]>();
  let commercialContext: Awaited<ReturnType<typeof getDashboardCommercialContext>> | null =
    null;
  let launchStats: Awaited<ReturnType<typeof getWorkshopLaunchDashboardStats>> | null =
    null;
  let primaryDomainId = "";

  if (creator) {
    const supabase = createPlatformClient();
    commercialContext = await getDashboardCommercialContext(
      creator.id,
      creator.creator_types ?? []
    );
    launchStats = await getWorkshopLaunchDashboardStats(creator.id);
    const [workshopsResult, requestsResult, creatorDomainsResult] =
      await Promise.all([
        supabase
          .from("workshops")
          .select("*")
          .eq("creator_id", creator.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("workshop_booking_requests")
          .select(
            "id, workshop_id, full_name, email, message, status, created_at, workshops(title)"
          )
          .eq("creator_id", creator.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("creator_domains")
          .select("domain_id")
          .eq("creator_id", creator.id),
      ]);

    workshops = (workshopsResult.data ?? []) as Workshop[];
    bookingRequests = (requestsResult.data ?? []) as BookingRequest[];

    primaryDomainId =
      ((creatorDomainsResult.data ?? []) as Array<{ domain_id: string }>)[0]
        ?.domain_id ??
      domains[0]?.id ??
      "";

    const workshopIds = workshops.map((workshop) => workshop.id);
    if (workshopIds.length > 0) {
      const [{ data: galleryData }, { data: sessionsData }] = await Promise.all([
        supabase
          .from("workshop_gallery_images")
          .select("id, workshop_id, image_url, sort_order")
          .in("workshop_id", workshopIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("workshop_sessions")
          .select(
            "id, workshop_id, starts_at, ends_at, capacity, remaining_spots, is_cancelled, booking_status"
          )
          .in("workshop_id", workshopIds)
          .order("starts_at", { ascending: true }),
      ]);

      for (const image of (galleryData ?? []) as GalleryImage[]) {
        const list = galleryByWorkshop.get(image.workshop_id) ?? [];
        list.push(image);
        galleryByWorkshop.set(image.workshop_id, list);
      }

      for (const session of (sessionsData ?? []) as WorkshopSessionRow[]) {
        const list = sessionsByWorkshop.get(session.workshop_id) ?? [];
        list.push(session);
        sessionsByWorkshop.set(session.workshop_id, list);
      }
    }
  }

  const workshopTitles = new Map(
    workshops.map((workshop) => [workshop.id, workshop.title])
  );

  const domainOptions = domains.map((domain) => ({
    value: domain.id,
    label: domain.name,
  }));

  const now = Date.now();

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Workshopbeheer</h1>
      <p className="text-[var(--muted)]">
        Beheer workshops met data, en behandel boekingsaanvragen. Boeken gebeurt via
        aanvraag op Hobbysalon.
        {launchStats ? (
          <>
            {" "}
            {WORKSHOP_LAUNCH_COPY.freeSlotsLabel(
              launchStats.launchFreeUsed,
              WORKSHOP_FREE_LISTING_CAP
            )}
            .
          </>
        ) : null}
        {commercialContext?.workshopLimit != null && !launchStats?.launchWindowOpen ? (
          <>
            {" "}
            Actieve workshops: {commercialContext.activeWorkshopCount}/
            {commercialContext.workshopLimit}
          </>
        ) : null}
      </p>

      {launchStats ? (
        <CardShell
          variant="featured"
          padding="md"
          className="border-[var(--accent)]/30 bg-[var(--section-highlight)]"
        >
          <p className="font-semibold text-[var(--foreground)]">
            {WORKSHOP_LAUNCH_COPY.offerHeadline}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {WORKSHOP_LAUNCH_COPY.offerBody}
          </p>
          {!launchStats.canGrantFree ? (
            <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
              Extra vermeldingen: {WORKSHOP_LAUNCH_COPY.feeLabel}{" "}
              {WORKSHOP_LAUNCH_COPY.feePeriodLabel}.
            </p>
          ) : null}
        </CardShell>
      ) : null}

      {checkout === "pending" ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Betaling ontvangen. Je vermelding wordt zo actief — vernieuw de pagina over enkele
          seconden als de status nog niet klopt.
        </p>
      ) : null}
      {checkout === "cancelled" ? (
        <p className="rounded-md border border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)]">
          Betaling geannuleerd. Je workshop blijft een concept tot je betaalt of een gratis
          slot gebruikt.
        </p>
      ) : null}

      {!caps.canPublishWorkshops ? (
        <CardShell
          variant="featured"
          padding="md"
          className="border-amber-300 bg-amber-50"
        >
          <p className="font-semibold text-amber-950">Status: In beoordeling</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
            Je kunt workshops opslaan als concept. Publiceren kan pas nadat je
            workshopgeverrol is goedgekeurd. We sturen je een e-mail zodra dat
            gebeurt.
          </p>
        </CardShell>
      ) : (
        <CardShell variant="default" padding="md">
          <p className="text-sm text-[var(--muted)]">
            Status: <span className="font-semibold text-[var(--foreground)]">Goedgekeurd</span> —
            je mag concepten publiceren.
          </p>
        </CardShell>
      )}

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
            <form action={createWorkshopAction} encType="multipart/form-data">
              <h2 className="text-lg font-semibold">Nieuwe workshop</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Elke workshop heeft minstens één datum. Bezoekers sturen een aanvraag via
                Hobbysalon.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Titel *</span>
                  <input
                    name="title"
                    required
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <WorkshopTaxonomyFields
                  categories={workshopCategories}
                  domainOptions={domainOptions}
                  defaults={{ domain_id: primaryDomainId }}
                />
                <label>
                  <span className="mb-1 block text-sm font-medium">Format *</span>
                  <select
                    name="format_type"
                    defaultValue="physical"
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  >
                    {FORMAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-sm font-medium">Niveau *</span>
                  <select
                    name="difficulty_level"
                    defaultValue="beginner"
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  >
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-sm font-medium">Start *</span>
                  <input
                    name="session_starts_at"
                    type="datetime-local"
                    required
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-medium">Einde *</span>
                  <input
                    name="session_ends_at"
                    type="datetime-local"
                    required
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-medium">Locatie of zaal</span>
                  <input
                    name="location_name"
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-medium">Stad</span>
                  <input
                    name="city"
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-medium">Prijs (€)</span>
                  <input
                    name="price_euro"
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={0}
                    placeholder="0,00"
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-medium">Duur (min)</span>
                  <input
                    name="duration_minutes"
                    type="number"
                    min={0}
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-medium">Capaciteit</span>
                  <input
                    name="capacity"
                    type="number"
                    min={0}
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <div className="sm:col-span-2">
                  <ImageUploadField
                    name="featured_image_file"
                    label="Hoofdfoto"
                    uploadPathPrefix={`creators/${creator.id}/workshops`}
                    hint="Deze foto verschijnt als eerste op je workshoppagina."
                  />
                </div>
                <div className="sm:col-span-2">
                  <MultiImageUploadField
                    uploadPathPrefix={`creators/${creator.id}/workshops/gallery`}
                    label="Extra foto's"
                    hint="Optioneel. Voeg meerdere foto's toe van locatie, materialen of resultaat."
                  />
                </div>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Korte omschrijving</span>
                  <input
                    name="short_description"
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Omschrijving</span>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
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
            <p className="text-sm text-[var(--muted)]">
              Open een workshop, scroll naar beneden en kies{" "}
              <span className="font-medium text-[var(--foreground)]">Verwijder concept</span>{" "}
              om een concept weg te doen. Extra foto&apos;s verwijder je met de knop onder de
              foto.
            </p>
            {workshops.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-sm text-[var(--muted)]">
                Nog geen workshops.
              </p>
            ) : (
              workshops.map((workshop) => {
                const gallery = galleryByWorkshop.get(workshop.id) ?? [];
                const sessions = sessionsByWorkshop.get(workshop.id) ?? [];
                const upcoming = sessions.find(
                  (session) =>
                    !session.is_cancelled &&
                    new Date(session.starts_at).getTime() >= now
                );
                const feeStatus = workshop.listing_fee_status ?? "unpaid";
                const feeVisible = isWorkshopListingPubliclyVisible({
                  is_active: workshop.is_active,
                  listing_fee_status: feeStatus,
                  listing_expires_at: workshop.listing_expires_at,
                });
                const needsListingPayment =
                  feeStatus !== "launch_free" &&
                  !(
                    feeStatus === "paid" &&
                    workshop.listing_expires_at &&
                    new Date(workshop.listing_expires_at).getTime() > now
                  );
                const feeLabel =
                  feeStatus === "launch_free"
                    ? "gratis lancering"
                    : feeStatus === "paid" && feeVisible
                      ? "betaald"
                      : feeStatus === "paid"
                        ? "verlopen"
                        : "wacht op betaling";
                return (
                  <details
                    key={workshop.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
                  >
                    <summary className="cursor-pointer list-none font-medium">
                      {workshop.title}{" "}
                      <span className="text-sm font-normal text-[var(--muted)]">
                        ({workshop.format_type})
                        {workshop.is_active ? " · actief" : " · concept"}
                        {` · ${feeLabel}`}
                        {upcoming
                          ? ` · ${formatSessionDate(upcoming.starts_at)}`
                          : sessions.length === 0
                            ? " · geen datum"
                            : " · geen komende datum"}
                      </span>
                    </summary>
                    <form
                      action={updateWorkshopAction}
                      encType="multipart/form-data"
                      className="mt-4 grid gap-3 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={workshop.id} />
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-sm font-medium">Titel</span>
                        <input
                          name="title"
                          required
                          defaultValue={workshop.title}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        />
                      </label>
                      <WorkshopTaxonomyFields
                        categories={workshopCategories}
                        domainOptions={domainOptions}
                        defaults={{
                          domain_id: workshop.domain_id,
                          category_id: workshop.category_id,
                          offer_type: workshop.offer_type,
                          audience_types: workshop.audience_types,
                          age_groups: workshop.age_groups,
                          languages: workshop.languages,
                        }}
                      />
                      <label>
                        <span className="mb-1 block text-sm font-medium">Format</span>
                        <select
                          name="format_type"
                          defaultValue={workshop.format_type}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        >
                          {FORMAT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="mb-1 block text-sm font-medium">Niveau</span>
                        <select
                          name="difficulty_level"
                          defaultValue={workshop.difficulty_level}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        >
                          {DIFFICULTY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="mb-1 block text-sm font-medium">Locatie</span>
                        <input
                          name="location_name"
                          defaultValue={workshop.location_name ?? ""}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-sm font-medium">Stad</span>
                        <input
                          name="city"
                          defaultValue={workshop.city ?? ""}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-sm font-medium">Prijs (€)</span>
                        <input
                          name="price_euro"
                          type="number"
                          min={0}
                          step={0.01}
                          defaultValue={formatEuroFromCents(workshop.price_cents)}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-sm font-medium">Duur (min)</span>
                        <input
                          name="duration_minutes"
                          type="number"
                          min={0}
                          defaultValue={workshop.duration_minutes ?? ""}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-sm font-medium">Capaciteit</span>
                        <input
                          name="capacity"
                          type="number"
                          min={0}
                          defaultValue={workshop.capacity ?? ""}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <ImageUploadField
                          name="featured_image_file"
                          label="Hoofdfoto"
                          currentUrl={workshop.featured_image_url}
                          uploadPathPrefix={`creators/${creator.id}/workshops`}
                          hint="Laat leeg om de huidige foto te behouden."
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-3">
                        <p className="text-sm font-medium">Extra foto&apos;s ({gallery.length})</p>
                        {gallery.length > 0 ? (
                          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {gallery.map((image) => (
                              <li key={image.id} className="space-y-1">
                                <img
                                  src={image.image_url}
                                  alt=""
                                  className="aspect-square w-full rounded-lg border border-[var(--border)] object-cover"
                                />
                                <button
                                  type="submit"
                                  name="gallery_image_id"
                                  value={image.id}
                                  formAction={deleteWorkshopGalleryImageAction}
                                  formNoValidate
                                  className="text-xs text-red-700 hover:underline"
                                >
                                  Verwijder
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-[var(--muted)]">Nog geen extra foto&apos;s.</p>
                        )}
                        <MultiImageUploadField
                          uploadPathPrefix={`creators/${creator.id}/workshops/gallery`}
                          label="Extra foto's toevoegen"
                          existingCount={gallery.length}
                          hint="Worden bewaard wanneer je Opslaan klikt. Vierkant · min. 1000×1000 px."
                        />
                      </div>
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-sm font-medium">
                          Korte omschrijving
                        </span>
                        <input
                          name="short_description"
                          defaultValue={workshop.short_description ?? ""}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-sm font-medium">Omschrijving</span>
                        <textarea
                          name="description"
                          rows={3}
                          defaultValue={workshop.description ?? ""}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        />
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="is_active"
                          defaultChecked={workshop.is_active}
                        />
                        <span className="text-sm">Actief</span>
                      </label>
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <button
                          type="submit"
                          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]"
                        >
                          Opslaan
                        </button>
                        <ConfirmSubmitButton
                          variant="danger"
                          size="sm"
                          formAction={deleteWorkshopAction}
                          formNoValidate
                          message={
                            workshop.is_active
                              ? "Deze workshop verdwijnt van de site. Doorgaan?"
                              : "Dit concept definitief verwijderen?"
                          }
                        >
                          {workshop.is_active
                            ? "Workshop verwijderen"
                            : "Verwijder concept"}
                        </ConfirmSubmitButton>
                      </div>
                    </form>

                    {needsListingPayment ||
                    (feeStatus === "paid" && workshop.listing_expires_at) ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
                        {needsListingPayment ? (
                          <form action={createWorkshopListingCheckoutAction}>
                            <input
                              type="hidden"
                              name="workshop_id"
                              value={workshop.id}
                            />
                            <Button type="submit" variant="primary">
                              Activeer voor {WORKSHOP_LAUNCH_COPY.feeLabel} (2
                              maanden)
                            </Button>
                          </form>
                        ) : null}
                        {feeStatus === "paid" && workshop.listing_expires_at ? (
                          <p className="text-sm text-[var(--muted)]">
                            Zichtbaar tot{" "}
                            {new Intl.DateTimeFormat("nl-BE", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }).format(new Date(workshop.listing_expires_at))}
                            {!feeVisible
                              ? ` — ${WORKSHOP_LAUNCH_COPY.expiredMessage}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-6 border-t border-[var(--border)] pt-4">
                      <h3 className="text-sm font-semibold">Data / kalender</h3>
                      {sessions.length === 0 ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Nog geen data. Voeg hieronder een datum toe.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {sessions.map((session) => (
                            <li
                              key={session.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                            >
                              <div>
                                <p
                                  className={
                                    session.is_cancelled
                                      ? "text-[var(--muted)] line-through"
                                      : undefined
                                  }
                                >
                                  {formatSessionDate(session.starts_at)}
                                  {" – "}
                                  {new Intl.DateTimeFormat("nl-BE", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }).format(new Date(session.ends_at))}
                                </p>
                                <p className="text-xs text-[var(--muted)]">
                                  {session.is_cancelled
                                    ? "Geannuleerd"
                                    : session.booking_status === "open"
                                      ? "Open voor aanvragen"
                                      : session.booking_status}
                                  {session.capacity != null
                                    ? ` · max. ${session.capacity}`
                                    : ""}
                                </p>
                              </div>
                              {!session.is_cancelled && (
                                <form action={cancelWorkshopSessionAction}>
                                  <input
                                    type="hidden"
                                    name="session_id"
                                    value={session.id}
                                  />
                                  <button
                                    type="submit"
                                    className="text-xs text-red-700 hover:underline"
                                  >
                                    Annuleer datum
                                  </button>
                                </form>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <form
                        action={createWorkshopSessionAction}
                        className="mt-4 grid gap-3 sm:grid-cols-2"
                      >
                        <input type="hidden" name="workshop_id" value={workshop.id} />
                        <label>
                          <span className="mb-1 block text-sm font-medium">
                            Nieuwe start *
                          </span>
                          <input
                            name="session_starts_at"
                            type="datetime-local"
                            required
                            className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-sm font-medium">
                            Nieuw einde *
                          </span>
                          <input
                            name="session_ends_at"
                            type="datetime-local"
                            required
                            className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                          />
                        </label>
                        <div className="sm:col-span-2">
                          <Button type="submit" variant="secondary" size="sm">
                            Datum toevoegen
                          </Button>
                        </div>
                      </form>
                    </div>
                  </details>
                );
              })
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Boekingsaanvragen ({bookingRequests.length})
            </h2>
            {bookingRequests.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-sm text-[var(--muted)]">
                Nog geen boekingsaanvragen.
              </p>
            ) : (
              bookingRequests.map((request) => {
                const isNew = request.status === "new";
                return (
                  <div
                    key={request.id}
                    className={`rounded-lg border p-4 ${
                      isNew
                        ? "border-amber-300 bg-amber-50/60"
                        : "border-[var(--border)] bg-[var(--card)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[var(--foreground)]">
                            {request.full_name} · {request.email}
                          </p>
                          {isNew ? (
                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                              Nieuw
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-[var(--muted)]">
                          Workshop:{" "}
                          {bookingWorkshopTitle(request, workshopTitles)}
                        </p>
                        {request.message && (
                          <p className="mt-1 text-sm text-[var(--foreground)]">
                            {request.message}
                          </p>
                        )}
                      </div>
                      <form
                        action={updateBookingRequestStatusAction}
                        className="flex items-center gap-2"
                      >
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
                );
              })
            )}
          </div>
        </>
      )}
    </section>
  );
}
