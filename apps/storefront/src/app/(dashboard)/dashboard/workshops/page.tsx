import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import {
  createWorkshopAction,
  updateBookingRequestStatusAction,
  updateWorkshopAction,
  linkWorkshopProductAction,
  unlinkWorkshopProductAction,
  deleteWorkshopGalleryImageAction,
} from "@/app/actions/dashboard";
import { getDashboardCommercialContext } from "@/lib/platform/commercial-enforcement";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { MultiImageUploadField } from "@/components/ui/multi-image-upload-field";
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

type MaterialOption = {
  id: string;
  title: string;
};

type GalleryImage = {
  id: string;
  workshop_id: string;
  image_url: string;
  sort_order: number;
};

type LinkedMaterial = {
  workshop_id: string;
  product_id: string;
  is_required: boolean;
  products: { title: string } | { title: string }[] | null;
};

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

function formatEuroFromCents(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function productTitle(
  products: LinkedMaterial["products"],
  fallback: string
): string {
  if (!products) return fallback;
  if (Array.isArray(products)) return products[0]?.title ?? fallback;
  return products.title;
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
  if (!user) {
    redirect("/login?next=/dashboard/workshops");
  }

  const [creator, registrationContext, domains] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
    listDomainsBySort(),
  ]);
  const caps = resolveDashboardCapabilities({
    registrationContext,
    creatorTypes: creator?.creator_types,
    hasCreatorProfile: Boolean(creator),
  });
  requireDashboardCapability(caps.canManageWorkshops);

  const { success, error } = await searchParams;

  let workshops: Workshop[] = [];
  let bookingRequests: BookingRequest[] = [];
  let materialOptions: MaterialOption[] = [];
  let galleryByWorkshop = new Map<string, GalleryImage[]>();
  let materialsByWorkshop = new Map<string, LinkedMaterial[]>();
  let commercialContext: Awaited<ReturnType<typeof getDashboardCommercialContext>> | null =
    null;
  let primaryDomainId = "";

  if (creator) {
    const supabase = createPlatformClient();
    commercialContext = await getDashboardCommercialContext(
      creator.id,
      creator.creator_types ?? []
    );
    const [
      workshopsResult,
      requestsResult,
      materialsResult,
      creatorDomainsResult,
      ownProductsResult,
    ] = await Promise.all([
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
      supabase
        .from("products")
        .select("id, title")
        .in("product_type", ["supply", "workshop_kit", "supplies"])
        .eq("is_active", true)
        .order("title", { ascending: true })
        .limit(200),
      supabase
        .from("creator_domains")
        .select("domain_id")
        .eq("creator_id", creator.id),
      supabase
        .from("products")
        .select("id, title")
        .eq("creator_id", creator.id)
        .eq("is_active", true)
        .order("title", { ascending: true })
        .limit(100),
    ]);

    workshops = (workshopsResult.data ?? []) as Workshop[];
    bookingRequests = (requestsResult.data ?? []) as BookingRequest[];

    const materialMap = new Map<string, MaterialOption>();
    for (const row of (materialsResult.data ?? []) as MaterialOption[]) {
      materialMap.set(row.id, row);
    }
    for (const row of (ownProductsResult.data ?? []) as MaterialOption[]) {
      materialMap.set(row.id, row);
    }
    materialOptions = Array.from(materialMap.values()).sort((a, b) =>
      a.title.localeCompare(b.title, "nl")
    );

    primaryDomainId =
      ((creatorDomainsResult.data ?? []) as Array<{ domain_id: string }>)[0]
        ?.domain_id ??
      domains[0]?.id ??
      "";

    const workshopIds = workshops.map((workshop) => workshop.id);
    if (workshopIds.length > 0) {
      const [galleryResult, linkedMaterialsResult] = await Promise.all([
        supabase
          .from("workshop_gallery_images")
          .select("id, workshop_id, image_url, sort_order")
          .in("workshop_id", workshopIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("workshop_required_products")
          .select("workshop_id, product_id, is_required, products(title)")
          .in("workshop_id", workshopIds)
          .order("sort_order", { ascending: true }),
      ]);

      for (const image of (galleryResult.data ?? []) as GalleryImage[]) {
        const list = galleryByWorkshop.get(image.workshop_id) ?? [];
        list.push(image);
        galleryByWorkshop.set(image.workshop_id, list);
      }
      for (const link of (linkedMaterialsResult.data ?? []) as LinkedMaterial[]) {
        const list = materialsByWorkshop.get(link.workshop_id) ?? [];
        list.push(link);
        materialsByWorkshop.set(link.workshop_id, list);
      }
    }
  }

  const domainOptions = domains.map((domain) => ({
    value: domain.id,
    label: domain.name,
  }));

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
            <form action={createWorkshopAction} encType="multipart/form-data">
              <h2 className="text-lg font-semibold">Nieuwe workshop</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Titel *</span>
                  <input
                    name="title"
                    required
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-medium">Categorie / domein</span>
                  <select
                    name="domain_id"
                    defaultValue={primaryDomainId}
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  >
                    <option value="">Selecteer categorie</option>
                    {domainOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
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
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Boekingsmode *</span>
                  <select
                    name="booking_mode"
                    defaultValue="request"
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  >
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
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">
                    Materiaal koppelen (optioneel)
                  </span>
                  <select
                    name="product_id"
                    defaultValue=""
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  >
                    <option value="">Geen materiaal — later toevoegen kan ook</option>
                    {materialOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.title}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Niet verplicht. Kies een kit of materiaal uit de catalogus als deelnemers
                    iets nodig hebben.
                  </p>
                </label>
                <label className="inline-flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" name="is_required" />
                  <span className="text-sm">
                    Gekozen materiaal is verplicht voor deelnemers
                  </span>
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
              workshops.map((workshop) => {
                const gallery = galleryByWorkshop.get(workshop.id) ?? [];
                const linkedMaterials = materialsByWorkshop.get(workshop.id) ?? [];
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
                      <label>
                        <span className="mb-1 block text-sm font-medium">
                          Categorie / domein
                        </span>
                        <select
                          name="domain_id"
                          defaultValue={workshop.domain_id ?? ""}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        >
                          <option value="">Selecteer categorie</option>
                          {domainOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
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
                        <span className="mb-1 block text-sm font-medium">Boekingsmode</span>
                        <select
                          name="booking_mode"
                          defaultValue={workshop.booking_mode}
                          className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                        >
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
                                <form action={deleteWorkshopGalleryImageAction}>
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
                        ) : (
                          <p className="text-xs text-[var(--muted)]">Nog geen extra foto&apos;s.</p>
                        )}
                        <MultiImageUploadField
                          uploadPathPrefix={`creators/${creator.id}/workshops/gallery`}
                          label="Extra foto's toevoegen"
                          hint="Worden bewaard wanneer je Opslaan klikt."
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
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]"
                        >
                          Opslaan
                        </button>
                      </div>
                    </form>

                    <div className="mt-4 border-t border-[var(--border)] pt-4">
                      <p className="text-sm font-medium">
                        Materialen (optioneel) · {linkedMaterials.length} gekoppeld
                      </p>
                      {linkedMaterials.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {linkedMaterials.map((link) => (
                            <li
                              key={`${link.workshop_id}-${link.product_id}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                            >
                              <span>
                                {productTitle(link.products, link.product_id)}
                                {link.is_required ? " · verplicht" : " · optioneel"}
                              </span>
                              <form action={unlinkWorkshopProductAction}>
                                <input
                                  type="hidden"
                                  name="workshop_id"
                                  value={workshop.id}
                                />
                                <input
                                  type="hidden"
                                  name="product_id"
                                  value={link.product_id}
                                />
                                <button
                                  type="submit"
                                  className="text-xs text-red-700 hover:underline"
                                >
                                  Ontkoppelen
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Geen materialen gekoppeld. Dat mag — je kan later nog iets
                          toevoegen.
                        </p>
                      )}
                      <form
                        action={linkWorkshopProductAction}
                        className="mt-3 grid gap-3 sm:grid-cols-2"
                      >
                        <input type="hidden" name="workshop_id" value={workshop.id} />
                        <label className="sm:col-span-2">
                          <span className="mb-1 block text-sm font-medium">
                            Materiaal toevoegen
                          </span>
                          <select
                            name="product_id"
                            defaultValue=""
                            className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                          >
                            <option value="">Kies een materiaal (optioneel)</option>
                            {materialOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" name="is_required" />
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
              bookingRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">
                        {request.full_name} · {request.email}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        Workshop:{" "}
                        {request.workshops?.[0]?.title ?? request.workshop_id}
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
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
