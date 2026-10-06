import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  cancelWorkshopSessionAction,
  createWorkshopSessionAction,
  deleteWorkshopAction,
  deleteWorkshopGalleryImageAction,
  updateWorkshopAction,
} from "@/app/actions/dashboard";
import { createWorkshopListingCheckoutAction } from "@/app/actions/listing-checkout";
import { createPlatformClient } from "@/lib/platform/client";
import { getDashboardContext, formatDashboardDate, loadInbox } from "@/lib/dashboard/load";
import { loadOfferFormOptions } from "@/lib/dashboard/form-options";
import { resolveWorkshopStatus } from "@/lib/dashboard/offer-status";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { WORKSHOP_LAUNCH_COPY } from "@/lib/pricing/workshop-launch-offer";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  DashboardNotice,
  DashboardPageHeader,
  FlashMessage,
  StatusPill,
} from "@/components/dashboard/ui";
import { FormActions, TextField } from "@/components/dashboard/form";
import { WorkshopFormFields } from "@/components/dashboard/WorkshopFormFields";
import { GalleryManager } from "@/components/dashboard/GalleryManager";
import { ItemRequestList } from "@/components/dashboard/ItemRequestList";
import type { Workshop } from "@/types/platform";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string; checkout?: string }>;
};

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditWorkshopPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { success, error, checkout } = await searchParams;
  if (!UUID.test(id)) notFound();

  const path = `/dashboard/workshops/${id}`;
  const { creator, caps } = await getDashboardContext(path);
  requireDashboardCapability(caps.canDraftWorkshops);
  if (!creator) redirect("/dashboard/pagina");

  const supabase = createPlatformClient();
  const { data: workshopRow } = await supabase
    .from("workshops")
    .select("*")
    .eq("id", id)
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (!workshopRow) notFound();
  const workshop = workshopRow as Workshop;

  const [options, galleryResult, sessionsResult, requests] = await Promise.all([
    loadOfferFormOptions(creator.id),
    supabase
      .from("workshop_gallery_images")
      .select("id, image_url, sort_order")
      .eq("workshop_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("workshop_sessions")
      .select("id, starts_at, ends_at, capacity, is_cancelled, booking_status")
      .eq("workshop_id", id)
      .order("starts_at", { ascending: true }),
    loadInbox({
      creatorId: creator.id,
      includeCreations: false,
      includeWorkshops: true,
      includeEvents: false,
      itemId: id,
      limit: 50,
    }),
  ]);

  const gallery = (galleryResult.data ?? []) as Array<{ id: string; image_url: string }>;
  const sessions = (sessionsResult.data ?? []) as Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    capacity: number | null;
    is_cancelled: boolean;
    booking_status: string;
  }>;
  const now = Date.now();
  const upcoming = sessions.filter(
    (session) => !session.is_cancelled && new Date(session.starts_at).getTime() >= now
  );
  const past = sessions.filter(
    (session) => session.is_cancelled || new Date(session.starts_at).getTime() < now
  );

  const status = resolveWorkshopStatus({
    is_active: workshop.is_active,
    listing_fee_status: workshop.listing_fee_status,
    listing_expires_at: workshop.listing_expires_at,
    canPublish: caps.canPublishWorkshops,
  });
  const newRequests = requests.filter((request) => request.isNew).length;

  // One notice for the single most relevant thing about this workshop.
  let notice: React.ReactNode = null;
  if (checkout === "pending") {
    notice = (
      <DashboardNotice title="Betaling ontvangen">
        Je workshop wordt zo zichtbaar. Vernieuw de pagina over enkele seconden.
      </DashboardNotice>
    );
  } else if (status === "review") {
    notice = (
      <DashboardNotice title="Wacht op goedkeuring" tone="attention">
        We bekijken je aanvraag als workshopgever. Tot dan blijft deze workshop een concept. Je
        krijgt een e-mail zodra je kan publiceren.
      </DashboardNotice>
    );
  } else if (status === "payment" || status === "expired") {
    notice = (
      <DashboardNotice
        title={status === "expired" ? "Je vermelding is verlopen" : "Nog niet zichtbaar"}
        tone="attention"
        action={
          <form action={createWorkshopListingCheckoutAction}>
            <input type="hidden" name="workshop_id" value={workshop.id} />
            <Button type="submit" size="lg">
              Zichtbaar maken voor {WORKSHOP_LAUNCH_COPY.feeLabel}
            </Button>
          </form>
        }
      >
        {WORKSHOP_LAUNCH_COPY.afterLaunchPrice}
      </DashboardNotice>
    );
  } else if (status === "visible" && upcoming.length === 0) {
    notice = (
      <DashboardNotice
        title="Geen komende datum"
        tone="attention"
        action={
          <Button asChild size="lg">
            <a href="#data">Datum toevoegen</a>
          </Button>
        }
      >
        Zonder datum kunnen bezoekers niet boeken.
      </DashboardNotice>
    );
  }

  return (
    <div className="max-w-4xl">
      <DashboardPageHeader
        title={workshop.title}
        back={{ href: "/dashboard/aanbod?soort=workshops", label: "Terug naar mijn aanbod" }}
        lead={
          <span className="flex flex-wrap items-center gap-3">
            <StatusPill status={status} />
            {status === "visible" ? (
              <Link
                href={`/workshop/${workshop.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--accent-hover)] underline underline-offset-4"
              >
                Bekijk op de site
              </Link>
            ) : null}
          </span>
        }
      />
      <FlashMessage success={success} error={error} />
      {notice}

      <nav aria-label="Onderdelen" className="mb-8 flex flex-wrap gap-2">
        {[
          { href: "#aanvragen", label: newRequests > 0 ? `Aanvragen (${newRequests})` : "Aanvragen" },
          { href: "#data", label: "Data" },
          { href: "#wat", label: "Gegevens" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="inline-flex min-h-12 items-center rounded-full border border-[var(--border-strong)] bg-[var(--card)] px-5 text-lg font-semibold text-[var(--foreground)] hover:border-[var(--foreground)]"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <section id="aanvragen" className="mb-10 scroll-mt-24" aria-labelledby="aanvragen-titel">
        <h2 id="aanvragen-titel" className="mb-4 text-2xl font-bold text-[var(--foreground)]">
          Boekingsaanvragen
        </h2>
        <ItemRequestList
          items={requests}
          returnTo={path}
          emptyText="Als iemand deze workshop wil boeken, verschijnt de aanvraag hier."
        />
      </section>

      <section
        id="data"
        className="mb-10 scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-7"
        aria-labelledby="data-titel"
      >
        <h2 id="data-titel" className="text-2xl font-bold text-[var(--foreground)]">
          Data
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-lg text-[var(--muted)]">Nog geen komende data.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {upcoming.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <span className="text-lg font-semibold text-[var(--foreground)]">
                  {formatDashboardDate(session.starts_at)}
                  {session.capacity != null ? (
                    <span className="font-normal text-[var(--muted)]">
                      {" "}
                      (max. {session.capacity} personen)
                    </span>
                  ) : null}
                </span>
                <form action={cancelWorkshopSessionAction}>
                  <input type="hidden" name="session_id" value={session.id} />
                  <input type="hidden" name="return_to" value={path} />
                  <ConfirmSubmitButton
                    variant="secondary"
                    message="Deze datum annuleren? Deelnemers met een aanvraag verwittig je zelf."
                  >
                    Datum annuleren
                  </ConfirmSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createWorkshopSessionAction} className="mt-6">
          <input type="hidden" name="workshop_id" value={workshop.id} />
          <input type="hidden" name="return_to" value={path} />
          <h3 className="text-xl font-semibold text-[var(--foreground)]">Nieuwe datum</h3>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <TextField name="session_starts_at" type="datetime-local" label="Begin" required />
            <TextField name="session_ends_at" type="datetime-local" label="Einde" required />
          </div>
          <Button type="submit" size="lg" className="mt-4">
            Datum toevoegen
          </Button>
        </form>

        {past.length > 0 ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-lg font-semibold text-[var(--muted)]">
              Voorbije en geannuleerde data ({past.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {past.map((session) => (
                <li key={session.id} className="text-lg text-[var(--muted)]">
                  {formatDashboardDate(session.starts_at)}
                  {session.is_cancelled ? ", geannuleerd" : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="mb-10">
        <GalleryManager
          images={gallery}
          action={deleteWorkshopGalleryImageAction}
          returnTo={path}
        />
      </div>

      <form action={updateWorkshopAction} encType="multipart/form-data">
        <input type="hidden" name="id" value={workshop.id} />
        <input type="hidden" name="return_to" value={path} />
        <WorkshopFormFields
          creatorId={creator.id}
          workshop={workshop}
          categories={options.workshopCategories}
          domainOptions={options.domainOptions}
          primaryDomainId={options.primaryDomainId}
          galleryCount={gallery.length}
          canPublish={caps.canPublishWorkshops}
          withFirstDate={false}
        />
        <FormActions>
          <Button type="submit" size="lg">
            Opslaan
          </Button>
          <ConfirmSubmitButton
            formAction={deleteWorkshopAction}
            formNoValidate
            variant="danger"
            size="lg"
            className="ml-auto"
            message={
              workshop.is_active
                ? "Deze workshop verdwijnt van de site en wordt verwijderd. Doorgaan?"
                : "Dit concept definitief verwijderen?"
            }
          >
            Verwijderen
          </ConfirmSubmitButton>
        </FormActions>
      </form>
    </div>
  );
}
