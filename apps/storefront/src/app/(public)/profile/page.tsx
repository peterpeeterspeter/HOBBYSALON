import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { getHobbyPassportData } from "@/lib/platform/queries/hobby-passport";
import { getLocationPreferenceFromCookies } from "@/lib/location/preference";
import {
  clearLocationPreferenceAction,
  updateLocationPreferenceAction,
} from "@/app/actions/location";
import { PageLayout } from "@/components/layout/page-layout";
import { GridLayout } from "@/components/layout/grid-layout";
import { CardShell } from "@/components/ui/card-shell";
import type { EntityType } from "@/types/platform";
import { listFavoriteFeed } from "@/lib/profile/favorite-feed";
import { SavedFeedCard } from "@/components/profile/SavedFeedCard";
import { EventCard } from "@/components/cards";
import { FeatureJourneyBanner } from "@/components/shared/FeatureJourneyBanner";
import { listEvents } from "@/lib/platform/queries/events";
import { createPlatformClient } from "@/lib/platform/client";
import { getSavedProjectSource, isStartableFavoriteType } from "@/lib/profile/saved-project-source";
import { resolveResumableSavedProjects } from "@/lib/profile/resumable-saved-project-service";
import { getMaterialCupboardEntries } from "@/lib/profile/material-cupboard";
import { listConfirmedNewsletterGuides } from "@/lib/platform/queries/confirmed-newsletter-guides";
import { CreatorMakerSection } from "@/components/profile/CreatorMakerSection";
import { loadCreatorMakerData } from "@/lib/profile/load-creator-maker-data";
import {
  createConfirmationToken,
  normalizeNewsletterEmail,
} from "@/lib/newsletter/lead-magnet";

type Props = {
  searchParams: Promise<{ success?: string; error?: string; tab?: string }>;
};

const EVENT_LABELS: Record<string, string> = {
  project_view: "Project bekeken",
  home_recommendations_viewed: "Aanbevelingen bekeken",
  bundle_add: "Bundel toegevoegd",
  add_to_cart: "Product toegevoegd aan winkelwagen",
  checkout_started: "Checkout gestart",
  checkout_completed: "Bestelling geplaatst",
  workshop_booking_request_submitted: "Workshop-aanvraag verstuurd",
  newsletter_signup: "Nieuwsbriefinschrijving",
  project_started: "Project gestart",
  project_item_completed: "Onderdeel afgevinkt",
  project_item_reopened: "Onderdeel opnieuw geopend",
  project_completed: "Project afgerond",
};

const FAVORITE_LABELS: Record<EntityType, string> = {
  domain: "Domeinen",
  creator: "Creators",
  product: "Producten",
  workshop: "Workshops",
  event: "Events",
  article: "Artikelen",
  project: "Projecten",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Nog geen activiteit";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function toPercent(progressValue: number, progressTarget: number): number {
  if (!progressTarget || progressTarget <= 0) return 0;
  return Math.min(100, Math.round((progressValue / progressTarget) * 100));
}

export const metadata: Metadata = {
  title: "Hobbypaspoort | Hobbysalon",
  description: "Jouw hobbyprofiel met progressie, badges, favorieten en activiteiten.",
};

export default async function ProfilePage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/profile");
  }

  const { success, error, tab } = await searchParams;
  const locationPreference = await getLocationPreferenceFromCookies();
  const supabase = createPlatformClient();
  const normalizedEmail = user.email ? normalizeNewsletterEmail(user.email) : null;
  const [passport, favoriteFeed, activityResult, savedFavorites, materialActivityResult, localEvents, confirmedGuides, creator, registrationContext] = await Promise.all([
    getHobbyPassportData(user.id),
    listFavoriteFeed(user.id, 6),
    supabase
      .from("user_activity_log")
      .select("event_name,entity_type,entity_id,occurred_at")
      .eq("user_id", user.id)
      .in("event_name", [
        "project_started",
        "project_item_completed",
        "project_item_reopened",
        "project_completed",
        "project_note_updated",
      ]),
    listFavoriteFeed(user.id, 80),
    supabase
      .from("user_activity_log")
      .select("event_name,entity_type,entity_id,occurred_at,metadata")
      .eq("user_id", user.id)
      .in("event_name", ["project_item_completed", "project_item_reopened"]),
    listEvents({
      preferred_city: locationPreference.city ?? undefined,
      preferred_country_code: locationPreference.countryCode ?? undefined,
      from_date: new Date().toISOString(),
      limit: 3,
    }),
    listConfirmedNewsletterGuides(normalizedEmail),
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
  ] as const);
  const caps = resolveDashboardCapabilities({
    registrationContext,
    creatorTypes: creator?.creator_types,
    hasCreatorProfile: Boolean(creator),
  });
  const showMakerSection = caps.canViewCreatorPage || caps.isHobbyistOnly;
  const makerData = showMakerSection ? await loadCreatorMakerData(user, tab) : null;
  const confirmationSecret = process.env.NEWSLETTER_CONFIRMATION_SECRET?.trim();
  const guidesWithDownloads = confirmedGuides.map((guide) => ({
    ...guide,
    token:
      normalizedEmail && confirmationSecret
        ? createConfirmationToken(
            { email: normalizedEmail, leadMagnetCode: guide.code },
            confirmationSecret
          )
        : null,
  }));
  const resumableProjects = await resolveResumableSavedProjects(
    (activityResult.data ?? []).map((event) => ({
      eventName: event.event_name,
      entityType: event.entity_type,
      entityId: event.entity_id,
      occurredAt: event.occurred_at,
    })),
    savedFavorites,
  );
  const startableFavoriteSources = savedFavorites.flatMap((item) => {
    const entityType = item.entityType;
    if (!item.canStartProject || !isStartableFavoriteType(entityType)) return [];
    return [{ entityType, entityId: item.id }];
  });
  const cupboardSources = (
    await Promise.all(
      startableFavoriteSources.map((source) =>
        getSavedProjectSource(source.entityType, source.entityId)
      )
    )
  ).filter((source): source is NonNullable<typeof source> => source !== null);
  const materialCupboardEntries = getMaterialCupboardEntries(
    cupboardSources,
    (materialActivityResult.data ?? []).map((event) => {
      const metadata = event.metadata as Record<string, unknown> | null;
      return {
        eventName: event.event_name,
        entityType: event.entity_type,
        entityId: event.entity_id,
        occurredAt: event.occurred_at,
        itemKey: typeof metadata?.item_key === "string" ? metadata.item_key : null,
      };
    })
  );

  return (
    <PageLayout title="Mijn profiel" description={`Ingelogd als ${user.email ?? "onbekende gebruiker"}`}>
      <CardShell variant="default" padding="lg" className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Hobbypaspoort
        </p>
        <GridLayout cols={4} className="mt-4">
          <CardShell variant="default" padding="md">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Punten</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
              {passport.profile.points}
            </p>
          </CardShell>
          <CardShell variant="default" padding="md">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Voltooide activiteiten
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
              {passport.profile.completedActivities}
            </p>
          </CardShell>
          <CardShell variant="default" padding="md">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Favorieten</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
              {passport.profile.favoriteCount}
            </p>
          </CardShell>
          <CardShell variant="default" padding="md">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Laatste activiteit</p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
              {formatDate(passport.profile.lastActivityAt)}
            </p>
          </CardShell>
        </GridLayout>
      </CardShell>

      <section className="mt-8" aria-label="Wat je met je profiel kunt doen">
        <FeatureJourneyBanner context="profile" />
      </section>

      {makerData ? (
        <CreatorMakerSection data={makerData} success={success} error={error} />
      ) : null}

      <CardShell variant="default" padding="lg" className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Locatie</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {locationPreference.label ?? "niet ingesteld"} — gebruikt voor aanbevelingen en evenementen bij jou in de buurt.
        </p>
        <form
          action={updateLocationPreferenceAction}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <input
            type="text"
            name="city"
            defaultValue={locationPreference.city ?? ""}
            placeholder="Stad (bv. Antwerpen)"
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] w-40"
          />
          <input
            type="text"
            name="country_code"
            defaultValue={locationPreference.countryCode ?? ""}
            placeholder="Landcode (BE)"
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] w-24"
          />
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
          >
            Opslaan
          </button>
        </form>
        {locationPreference.hasPreference && (
          <form action={clearLocationPreferenceAction} className="mt-2">
            <button
              type="submit"
              className="text-sm text-[var(--muted)] hover:text-[var(--accent)] hover:underline"
            >
              Wissen
            </button>
          </form>
        )}
      </CardShell>

      {locationPreference.hasPreference && localEvents.length > 0 && (
        <section className="mt-8" aria-labelledby="local-events-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="local-events-heading" className="text-2xl font-semibold text-[var(--foreground)]">Creatief bij jou in de buurt</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Evenementen gerangschikt voor {locationPreference.label}.</p>
            </div>
            <Link href="/agenda" className="text-sm font-semibold text-[var(--accent)] hover:underline">Bekijk agenda</Link>
          </div>
          <GridLayout cols={3} gap="lg" className="mt-4">{localEvents.map((event) => <EventCard key={event.id} event={event} />)}</GridLayout>
        </section>
      )}

      <CardShell variant="default" padding="lg" className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Mijn projecten</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload je eigen hobbyprojecten en koppel materialen uit de webshop of voeg gezochte producten toe.
        </p>
        <Link
          href="/profile/projects"
          className="mt-4 inline-block text-sm font-medium text-[var(--accent)] underline"
        >
          Naar mijn projecten
        </Link>
      </CardShell>

      {resumableProjects.length > 0 && (
        <section className="mt-8" aria-labelledby="pak-weer-op-heading">
          <div>
            <h2 id="pak-weer-op-heading" className="text-2xl font-semibold text-[var(--foreground)]">
              Pak weer op
            </h2>
            <p className="mt-1 text-base leading-relaxed text-[var(--muted)]">
              Je was hier al aan begonnen. Ga rustig verder wanneer het jou past.
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {resumableProjects.map((run) => (
              <article
                key={`${run.entityType}:${run.entityId}`}
                className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]"
              >
                {run.source.imageUrl && (
                  <img
                    src={run.source.imageUrl}
                    alt=""
                    className="aspect-[16/7] w-full object-cover"
                  />
                )}
                <div className="p-5">
                  <p className="text-sm font-medium text-[var(--muted)]">
                    {run.entityType === "article" ? "Artikel of patroon" : "Project"} · Laatst bezig op {formatDate(run.lastActivityAt)}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                    {run.source.title}
                  </h3>
                  <Link
                    href={`/profile/start/${run.entityType}/${run.entityId}`}
                    className="mt-4 inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-base font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                  >
                    Verder met dit project
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {materialCupboardEntries.length > 0 && (
        <section className="mt-8" aria-labelledby="material-cupboard-heading">
          <CardShell variant="default" padding="lg">
            <h2 id="material-cupboard-heading" className="text-2xl font-semibold text-[var(--foreground)]">
              Mijn materialenkast
            </h2>
            <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
              Materialen die je bij je bewaarde projecten als in huis hebt bevestigd.
            </p>
            <ul className="mt-5 divide-y divide-[var(--border)]" aria-label="Bevestigde materialen">
              {materialCupboardEntries.map((material) => (
                <li key={material.key} className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-3">
                  <span className="text-lg font-semibold text-[var(--foreground)]">{material.title}</span>
                  <span className="text-base text-[var(--muted)]">
                    {material.activeProjectCount === 1
                      ? "1 gekoppeld actief project"
                      : `${material.activeProjectCount} gekoppelde actieve projecten`}
                  </span>
                </li>
              ))}
            </ul>
          </CardShell>
        </section>
      )}

      {guidesWithDownloads.length > 0 && (
        <section className="mt-8" aria-labelledby="mijn-gidsen-heading">
          <CardShell variant="default" padding="lg">
            <h2 id="mijn-gidsen-heading" className="text-2xl font-semibold text-[var(--foreground)]">
              Mijn gidsen
            </h2>
            <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
              Je bevestigde downloads staan hier rustig voor je klaar.
            </p>
            <ul className="mt-5 divide-y divide-[var(--border)]" aria-label="Mijn bevestigde gidsen">
              {guidesWithDownloads.map((guide) => (
                <li key={guide.id} className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-lg font-semibold text-[var(--foreground)]">{guide.title}</span>
                  {guide.token ? (
                    <Link
                      href={`/nieuwsbrief/download/${encodeURIComponent(guide.code)}?token=${encodeURIComponent(guide.token)}`}
                      className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-base font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                    >
                      Download gids
                    </Link>
                  ) : (
                    <span className="text-base text-[var(--muted)]">Download tijdelijk niet beschikbaar</span>
                  )}
                </li>
              ))}
            </ul>
          </CardShell>
        </section>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Verder met je bewaarde ideeën</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Start een patroon, artikel of project wanneer jij er klaar voor bent.</p>
          </div>
          <Link href="/favorites" className="text-sm font-semibold text-[var(--accent)] hover:underline">Alle favorieten bekijken</Link>
        </div>
        {favoriteFeed.length === 0 ? (
          <CardShell variant="default" padding="lg" className="mt-4">
            <p className="text-[var(--muted)]">Bewaar een patroon, artikel, workshop of materiaal. Hier verschijnt daarna jouw persoonlijke ideeënfeed.</p>
          </CardShell>
        ) : (
          <GridLayout cols={3} gap="lg" className="mt-4">
            {favoriteFeed.map((item) => <SavedFeedCard key={`${item.entityType}:${item.id}`} item={item} />)}
          </GridLayout>
        )}
      </section>

      <CardShell variant="default" padding="lg" className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Voortgang per domein</h2>
        {passport.domainProgress.length === 0 ? (
          <p className="mt-3 text-[var(--muted)]">
            Nog geen domeinprogressie beschikbaar. Begin met favorieten opslaan of projecten bekijken.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {passport.domainProgress.map((domain) => (
              <div key={domain.domainId} className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-center justify-between">
                  <Link href={`/${domain.domainSlug}`} className="font-semibold text-[var(--foreground)]">
                    {domain.domainName}
                  </Link>
                  <span className="text-sm font-medium text-[var(--accent)]">
                    {domain.progressPercent}%
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--background)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent)]"
                    style={{ width: `${domain.progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Signalen: {domain.signalCount} · Completions: {domain.completionCount}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardShell>

      <CardShell variant="default" padding="lg" className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Badges</h2>
        {passport.badges.length === 0 ? (
          <p className="mt-3 text-[var(--muted)]">
            Nog geen badges beschikbaar.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {passport.badges.map((badge) => {
              const progressPercent = toPercent(badge.progressValue, badge.progressTarget);
              const unlocked = !!badge.unlockedAt;
              return (
                <article
                  key={badge.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    {unlocked ? "Ontgrendeld" : "In progress"}
                  </p>
                  <h3 className="mt-1 font-semibold text-[var(--foreground)]">{badge.badgeName}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{badge.badgeDescription}</p>
                  <div className="mt-3 h-2 rounded-full bg-[var(--card)]">
                    <div
                      className={unlocked ? "h-2 rounded-full bg-green-600" : "h-2 rounded-full bg-[var(--accent)]"}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {badge.progressValue}/{badge.progressTarget}
                    {unlocked && badge.unlockedAt
                      ? ` · ${formatDate(badge.unlockedAt)}`
                      : ""}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </CardShell>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <CardShell variant="default" padding="lg">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Favorieten overzicht</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(Object.keys(FAVORITE_LABELS) as EntityType[]).map((type) => (
              <li key={type} className="flex items-center justify-between">
                <span className="text-[var(--muted)]">{FAVORITE_LABELS[type]}</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {passport.favoritesSummary.byType[type]}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/favorites" className="mt-4 inline-block text-sm text-[var(--accent)] underline">
            Bekijk volledige favorietenlijst
          </Link>
        </CardShell>

        <CardShell variant="default" padding="lg">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Recente activiteit</h2>
          {passport.recentActivities.length === 0 ? (
            <p className="mt-3 text-[var(--muted)]">Nog geen recente activiteiten.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {passport.recentActivities.map((activity) => (
                <li key={activity.id} className="rounded-md border border-[var(--border)] p-3">
                  <p className="font-medium text-[var(--foreground)]">
                    {EVENT_LABELS[activity.eventName] ?? activity.eventName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatDate(activity.occurredAt)}
                    {activity.path ? ` · ${activity.path}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardShell>
      </div>
    </PageLayout>
  );
}
