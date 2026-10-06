import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  deleteEventAction,
  deleteEventGalleryImageAction,
  updateEventAction,
} from "@/app/actions/dashboard";
import { sendExhibitorOutreachAction } from "@/app/actions/exhibitor-outreach";
import { createPlatformClient } from "@/lib/platform/client";
import { getDashboardContext, loadInbox } from "@/lib/dashboard/load";
import { resolveEventStatus } from "@/lib/dashboard/offer-status";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { getDashboardCommercialContext } from "@/lib/platform/commercial-enforcement";
import { isCommercialGatingEnabled } from "@/lib/platform/commercial-entitlements";
import { LISTING_CREDIT_COSTS, getEventCreditCost } from "@/lib/platform/listing-credits";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  DashboardNotice,
  DashboardPageHeader,
  FlashMessage,
  StatusPill,
} from "@/components/dashboard/ui";
import { FormActions, TextAreaField } from "@/components/dashboard/form";
import { EventFormFields } from "@/components/dashboard/EventFormFields";
import { GalleryManager } from "@/components/dashboard/GalleryManager";
import { ItemRequestList } from "@/components/dashboard/ItemRequestList";
import type { Event } from "@/types/platform";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditEventPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { success, error } = await searchParams;
  if (!UUID.test(id)) notFound();

  const path = `/dashboard/events/${id}`;
  const { creator, caps } = await getDashboardContext(path);
  requireDashboardCapability(caps.canDraftEvents);
  if (!creator) redirect("/dashboard/pagina");

  const supabase = createPlatformClient();
  const { data: eventRow } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("organizer_creator_id", creator.id)
    .maybeSingle();
  if (!eventRow) notFound();
  const event = eventRow as Event;

  const [commercial, galleryResult, rosterResult, requests] = await Promise.all([
    getDashboardCommercialContext(creator.id, creator.creator_types ?? []),
    supabase
      .from("event_gallery_images")
      .select("id, image_url, sort_order")
      .eq("event_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("event_creators")
      .select("creator_id, creators(display_name, slug)")
      .eq("event_id", id)
      .eq("role", "vendor"),
    loadInbox({
      creatorId: creator.id,
      includeCreations: false,
      includeWorkshops: false,
      includeEvents: true,
      itemId: id,
      limit: 50,
    }),
  ]);

  const gallery = (galleryResult.data ?? []) as Array<{ id: string; image_url: string }>;
  const standhouders = ((rosterResult.data ?? []) as Array<{
    creator_id: string;
    creators:
      | { display_name: string; slug: string }
      | Array<{ display_name: string; slug: string }>
      | null;
  }>)
    .map((row) => (Array.isArray(row.creators) ? row.creators[0] : row.creators))
    .filter((row): row is { display_name: string; slug: string } => Boolean(row));

  const status = resolveEventStatus({ is_active: event.is_active, canPublish: caps.canPublishEvents });
  const gating = isCommercialGatingEnabled();
  const newRequests = requests.filter((request) => request.isNew).length;
  const isPast = new Date(event.ends_at).getTime() < Date.now();

  return (
    <div className="max-w-4xl">
      <DashboardPageHeader
        title={event.title}
        back={{ href: "/dashboard/aanbod?soort=events", label: "Terug naar mijn aanbod" }}
        lead={
          <span className="flex flex-wrap items-center gap-3">
            <StatusPill status={status} />
            {status === "visible" ? (
              <Link
                href={`/agenda/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--accent-hover)] underline underline-offset-4"
              >
                Bekijk in de agenda
              </Link>
            ) : null}
          </span>
        }
      />
      <FlashMessage success={success} error={error} />

      {status === "review" ? (
        <DashboardNotice title="Wacht op goedkeuring" tone="attention">
          We bekijken je aanvraag als organisator. Tot dan blijft dit event een concept. Je krijgt
          een e-mail zodra je kan publiceren.
        </DashboardNotice>
      ) : isPast ? (
        <DashboardNotice title="Dit event is voorbij">
          Het blijft bewaard. Wil je het opnieuw organiseren? Pas de datum aan en bewaar.
        </DashboardNotice>
      ) : null}

      <nav aria-label="Onderdelen" className="mb-8 flex flex-wrap gap-2">
        {[
          {
            href: "#aanvragen",
            label: newRequests > 0 ? `Aanvragen (${newRequests})` : "Aanvragen",
          },
          { href: "#standhouders", label: "Standhouders" },
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
          Aanvragen voor een standplaats
        </h2>
        <ItemRequestList
          items={requests}
          returnTo={path}
          emptyText="Wie een standplaats wil, vraagt dat aan via de eventpagina. Die aanvragen verschijnen hier."
        />
      </section>

      <section
        id="standhouders"
        className="mb-10 scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-7"
        aria-labelledby="standhouders-titel"
      >
        <h2 id="standhouders-titel" className="text-2xl font-bold text-[var(--foreground)]">
          Standhouders ({standhouders.length})
        </h2>
        {standhouders.length === 0 ? (
          <p className="mt-2 text-lg text-[var(--muted)]">
            Nog niemand bevestigd. Makers bevestigen zelf op de eventpagina.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {standhouders.map((standhouder) => (
              <li key={standhouder.slug}>
                <Link
                  href={`/creator/${standhouder.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-[var(--section-alt)] px-4 text-lg font-semibold text-[var(--foreground)] hover:underline"
                >
                  {standhouder.display_name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!isPast && status === "visible" ? (
          <form action={sendExhibitorOutreachAction} className="mt-6 border-t border-[var(--border)] pt-6">
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="return_to" value={path} />
            <h3 className="text-xl font-semibold text-[var(--foreground)]">Standhouders zoeken</h3>
            <p className="mt-1 max-w-[60ch] text-lg text-[var(--muted)]">
              We sturen een e-mail naar makers die openstaan voor markten en beurzen.
              {gating
                ? ` Dit kost ${LISTING_CREDIT_COSTS.exhibitorOutreach} credits.`
                : " Dit is momenteel gratis."}
            </p>
            <div className="mt-4 grid gap-5">
              <TextAreaField
                name="message"
                label="Persoonlijk bericht (niet verplicht)"
                rows={3}
              />
            </div>
            <ConfirmSubmitButton
              size="lg"
              variant="secondary"
              className="mt-4"
              message={
                gating
                  ? `Oproep versturen? Dit kost ${LISTING_CREDIT_COSTS.exhibitorOutreach} credits.`
                  : "Oproep versturen naar makers?"
              }
            >
              Oproep versturen
            </ConfirmSubmitButton>
          </form>
        ) : null}
      </section>

      <div className="mb-10">
        <GalleryManager images={gallery} action={deleteEventGalleryImageAction} returnTo={path} />
      </div>

      <form action={updateEventAction} encType="multipart/form-data">
        <input type="hidden" name="id" value={event.id} />
        <input type="hidden" name="return_to" value={path} />
        <EventFormFields
          creatorId={creator.id}
          event={event}
          galleryCount={gallery.length}
          canPublish={caps.canPublishEvents}
          allowExternalTickets={Boolean(commercial.allowExternalLinks)}
          typeCostLabel={
            gating && !event.is_active
              ? (type) => ` (${getEventCreditCost(type)} credits)`
              : undefined
          }
        />
        <FormActions>
          <Button type="submit" size="lg">
            Opslaan
          </Button>
          <ConfirmSubmitButton
            formAction={deleteEventAction}
            formNoValidate
            variant="danger"
            size="lg"
            className="ml-auto"
            message={
              event.is_active
                ? "Dit event verdwijnt uit de agenda en wordt verwijderd. Doorgaan?"
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
