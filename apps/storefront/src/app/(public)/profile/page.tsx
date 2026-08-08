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
import { Button } from "@/components/ui/button";
import { resolveAanbodNav } from "@/config/nav";
import type { EntityType } from "@/types/platform";
import { listFavoriteFeed } from "@/lib/profile/favorite-feed";
import { SavedFeedCard } from "@/components/profile/SavedFeedCard";
import { ProfileQuickLinks } from "@/components/profile/ProfileQuickLinks";
import { EventCard } from "@/components/cards";
import { listEvents } from "@/lib/platform/queries/events";
import { createPlatformClient } from "@/lib/platform/client";
import { getSavedProjectSource, isStartableFavoriteType } from "@/lib/profile/saved-project-source";
import { resolveResumableSavedProjects } from "@/lib/profile/resumable-saved-project-service";
import { getMaterialCupboardEntries } from "@/lib/profile/material-cupboard";
import { listConfirmedNewsletterGuides } from "@/lib/platform/queries/confirmed-newsletter-guides";
import { CreatorMakerSection } from "@/components/profile/CreatorMakerSection";
import { RoleUpgradeSection } from "@/components/auth/RoleUpgradeSection";
import { loadCreatorMakerData } from "@/lib/profile/load-creator-maker-data";
import {
  createConfirmationToken,
  normalizeNewsletterEmail,
} from "@/lib/newsletter/lead-magnet";
import { countNewProductInquiries } from "@/lib/platform/queries/product-inquiries";
import { CardShell } from "@/components/ui/card-shell";

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
  creator: "Makers",
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
  title: "Mijn Hobbysalon | Hobbysalon",
  description: "Pak projecten weer op, bekijk favorieten en beheer je aanbod.",
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
  const [
    passport,
    favoriteFeed,
    activityResult,
    savedFavorites,
    materialActivityResult,
    localEvents,
    confirmedGuides,
    creator,
    registrationContext,
  ] = await Promise.all([
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
  const newInquiryCount =
    creator && caps.canManageProducts
      ? await countNewProductInquiries(creator.id)
      : 0;
  const showMakerSection =
    caps.canViewCreatorPage ||
    (caps.hasOfferIntent && !caps.isHobbyistOnly);
  const aanbodNav = resolveAanbodNav({
    hasCreatorProfile: Boolean(creator),
    hasOfferIntent: caps.hasOfferIntent,
    hasMerchantAccess: caps.canViewVendorPortalNav,
  });
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
    savedFavorites
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

  const unlockedBadges = passport.badges.filter((badge) => badge.unlockedAt);
  const inProgressBadges = passport.badges
    .filter((badge) => !badge.unlockedAt)
    .sort((a, b) => {
      const aPct = toPercent(a.progressValue, a.progressTarget);
      const bPct = toPercent(b.progressValue, b.progressTarget);
      return bPct - aPct;
    });
  const featuredInProgress = inProgressBadges.slice(0, 3);
  const remainingInProgress = inProgressBadges.slice(3);
  const favoriteTypesWithCount = (Object.keys(FAVORITE_LABELS) as EntityType[]).filter(
    (type) => passport.favoritesSummary.byType[type] > 0
  );

  return (
    <PageLayout
      title="Mijn Hobbysalon"
      description={
        user.email
          ? `Welkom terug. Ingelogd als ${user.email}.`
          : "Welkom terug op je creatieve plek."
      }
      headerActions={
        <Button asChild variant="secondary" size="sm">
          <Link href={aanbodNav.href}>
            {aanbodNav.label}
            {newInquiryCount > 0 ? ` (${newInquiryCount})` : ""}
          </Link>
        </Button>
      }
    >
      {newInquiryCount > 0 ? (
        <CardShell
          variant="featured"
          padding="lg"
          className="mb-8 border-amber-300 bg-amber-50"
        >
          <p className="text-lg font-semibold text-amber-950">
            {newInquiryCount === 1
              ? "1 nieuwe aanvraag voor jouw plaatsingen"
              : `${newInquiryCount} nieuwe aanvragen voor jouw plaatsingen`}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-amber-900/80">
            Open je inbox om te antwoorden via e-mail. Jullie regelen de
            afspraak en betaling zelf.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/dashboard/products#aanvragen">Open aanvragen</Link>
            </Button>
          </div>
        </CardShell>
      ) : null}

      {/* 1. Compact passport strip */}
      <section
        aria-label="Hobbypaspoort samenvatting"
        className="border-y border-[var(--border)] py-5"
      >
        <p className="text-sm font-semibold text-[var(--accent)]">Hobbypaspoort</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-[var(--muted)]">Punten</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">
              {passport.profile.points}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--muted)]">Afgerond</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">
              {passport.profile.completedActivities}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--muted)]">Favorieten</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">
              {passport.profile.favoriteCount}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--muted)]">Laatst bezig</dt>
            <dd className="mt-1 text-base font-medium leading-snug text-[var(--foreground)]">
              {formatDate(passport.profile.lastActivityAt)}
            </dd>
          </div>
        </dl>
      </section>

      <ProfileQuickLinks
        showMakerLink={Boolean(makerData)}
        hasLocation={locationPreference.hasPreference && localEvents.length > 0}
        hasCreatorProfile={Boolean(creator)}
        hasOfferIntent={caps.hasOfferIntent}
        hasMerchantAccess={caps.canViewVendorPortalNav}
        primaryOfferLabel={
          registrationContext.preference?.primaryOfferRole === "workshopgever"
            ? "Workshopgever"
            : registrationContext.preference?.primaryOfferRole === "organizer"
              ? "Organisator"
              : registrationContext.preference?.primaryOfferRole === "maker"
                ? "Maker"
                : null
        }
      />

      {!creator && !caps.hasOfferIntent ? (
        <RoleUpgradeSection
          roles={registrationContext.roles}
          creatorTypes={null}
          hasCreatorProfile={false}
          pendingRoleRequests={registrationContext.pendingRoleRequests}
        />
      ) : null}

      {/* 2. Continue first */}
      {resumableProjects.length > 0 ? (
        <section className="mt-10" aria-labelledby="pak-weer-op-heading">
          <h2 id="pak-weer-op-heading" className="text-2xl font-semibold text-[var(--foreground)]">
            Pak weer op
          </h2>
          <p className="mt-1 max-w-[65ch] text-base leading-relaxed text-[var(--muted)]">
            Je was hier al aan begonnen. Ga verder wanneer het jou past.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {resumableProjects.map((run) => (
              <article
                key={`${run.entityType}:${run.entityId}`}
                className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
              >
                {run.source.imageUrl ? (
                  <img
                    src={run.source.imageUrl}
                    alt=""
                    className="aspect-[16/7] w-full object-cover"
                  />
                ) : null}
                <div className="p-5">
                  <p className="text-sm text-[var(--muted)]">
                    {run.entityType === "article" ? "Artikel of patroon" : "Project"}
                    {" · "}
                    Laatst bezig op {formatDate(run.lastActivityAt)}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold leading-snug text-[var(--foreground)]">
                    {run.source.title}
                  </h3>
                  <div className="mt-5 flex flex-col items-start gap-3">
                    <Link
                      href={`/profile/start/${run.entityType}/${run.entityId}`}
                      className="inline-flex min-h-12 items-center rounded-lg bg-[var(--accent)] px-5 text-base font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 active:scale-[0.98]"
                    >
                      Verder met dit project
                    </Link>
                    {run.source.sourceHref ? (
                      <Link
                        href={run.source.sourceHref}
                        className="text-base font-semibold text-[var(--accent)] underline underline-offset-4 hover:no-underline"
                      >
                        {run.source.sourceCtaLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* 3. Saved ideas */}
      <section id="bewaarde-ideeen" className="mt-10 scroll-mt-24" aria-labelledby="bewaarde-ideeen-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="bewaarde-ideeen-heading"
              className="text-2xl font-semibold text-[var(--foreground)]"
            >
              Bewaarde ideeën
            </h2>
            <p className="mt-1 max-w-[65ch] text-base leading-relaxed text-[var(--muted)]">
              Start een patroon, artikel of project wanneer jij er klaar voor bent.
            </p>
          </div>
          <Link
            href="/favorites"
            className="text-base font-semibold text-[var(--accent)] hover:underline"
          >
            Alle favorieten
          </Link>
        </div>
        {favoriteFeed.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-5 py-8">
            <p className="max-w-[65ch] text-base leading-relaxed text-[var(--muted)]">
              Bewaar een patroon, artikel, workshop of materiaal. Hier verschijnt daarna jouw
              persoonlijke ideeënfeed.
            </p>
            <Link
              href="/artikelen"
              className="mt-4 inline-flex min-h-11 items-center text-base font-semibold text-[var(--accent)] hover:underline"
            >
              Ontdek artikelen
            </Link>
          </div>
        ) : (
          <GridLayout cols={3} gap="lg" className="mt-5">
            {favoriteFeed.map((item) => (
              <SavedFeedCard key={`${item.entityType}:${item.id}`} item={item} />
            ))}
          </GridLayout>
        )}
      </section>

      {/* 4. Nearby events */}
      {locationPreference.hasPreference && localEvents.length > 0 ? (
        <section id="dichtbij" className="mt-10 scroll-mt-24" aria-labelledby="local-events-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="local-events-heading"
                className="text-2xl font-semibold text-[var(--foreground)]"
              >
                Dichtbij jou
              </h2>
              <p className="mt-1 text-base text-[var(--muted)]">
                Evenementen rond {locationPreference.label}.
              </p>
            </div>
            <Link
              href="/agenda"
              className="text-base font-semibold text-[var(--accent)] hover:underline"
            >
              Volledige agenda
            </Link>
          </div>
          <GridLayout cols={3} gap="lg" className="mt-5">
            {localEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </GridLayout>
        </section>
      ) : null}

      {/* 5. Materials + guides */}
      {materialCupboardEntries.length > 0 ? (
        <section className="mt-10" aria-labelledby="material-cupboard-heading">
          <h2
            id="material-cupboard-heading"
            className="text-2xl font-semibold text-[var(--foreground)]"
          >
            Materialenkast
          </h2>
          <p className="mt-1 max-w-[65ch] text-base leading-relaxed text-[var(--muted)]">
            Materialen die je bij bewaarde projecten als in huis hebt bevestigd.
          </p>
          <ul className="mt-5 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {materialCupboardEntries.map((material) => (
              <li
                key={material.key}
                className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-3"
              >
                <span className="text-lg font-semibold text-[var(--foreground)]">
                  {material.title}
                </span>
                <span className="text-base text-[var(--muted)]">
                  {material.activeProjectCount === 1
                    ? "1 actief project"
                    : `${material.activeProjectCount} actieve projecten`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {guidesWithDownloads.length > 0 ? (
        <section className="mt-10" aria-labelledby="mijn-gidsen-heading">
          <h2 id="mijn-gidsen-heading" className="text-2xl font-semibold text-[var(--foreground)]">
            Mijn gidsen
          </h2>
          <p className="mt-1 text-base text-[var(--muted)]">
            Je bevestigde downloads staan hier klaar.
          </p>
          <ul className="mt-5 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {guidesWithDownloads.map((guide) => (
              <li
                key={guide.id}
                className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="text-lg font-semibold text-[var(--foreground)]">{guide.title}</span>
                {guide.token ? (
                  <Link
                    href={`/nieuwsbrief/download/${encodeURIComponent(guide.code)}?token=${encodeURIComponent(guide.token)}`}
                    className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 text-base font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                  >
                    Download gids
                  </Link>
                ) : (
                  <span className="text-base text-[var(--muted)]">
                    Download tijdelijk niet beschikbaar
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 6. Own projects CTA */}
      <section
        className="mt-10 flex flex-col gap-4 border-y border-[var(--border)] py-6 sm:flex-row sm:items-center sm:justify-between"
        aria-labelledby="mijn-projecten-heading"
      >
        <div>
          <h2 id="mijn-projecten-heading" className="text-xl font-semibold text-[var(--foreground)]">
            Eigen hobbyprojecten
          </h2>
          <p className="mt-1 max-w-[65ch] text-base leading-relaxed text-[var(--muted)]">
            Upload je eigen projecten en koppel materialen uit de webshop.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/profile/projects">Naar mijn projecten</Link>
        </Button>
      </section>

      {/* 7. Maker (collapsed when complete) */}
      {makerData ? (
        <CreatorMakerSection data={makerData} success={success} error={error} />
      ) : null}

      {/* 8. Passport depth: badges first, then domains, then activity */}
      <section className="mt-10" aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="text-2xl font-semibold text-[var(--foreground)]">
          Badges
        </h2>
        <p className="mt-1 text-base text-[var(--muted)]">
          Kleine mijlpalen op je Hobbypaspoort.
        </p>
        {passport.badges.length === 0 ? (
          <p className="mt-4 text-base text-[var(--muted)]">Nog geen badges beschikbaar.</p>
        ) : (
          <>
            {unlockedBadges.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-[var(--accent-secondary)]">Ontgrendeld</p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {unlockedBadges.map((badge) => (
                    <li
                      key={badge.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                    >
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">
                        {badge.badgeName}
                      </h3>
                      <p className="mt-1 text-base leading-relaxed text-[var(--muted)]">
                        {badge.badgeDescription}
                      </p>
                      {badge.unlockedAt ? (
                        <p className="mt-3 text-sm text-[var(--muted)]">
                          {formatDate(badge.unlockedAt)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {featuredInProgress.length > 0 ? (
              <div className="mt-8">
                <p className="text-sm font-semibold text-[var(--muted)]">Bijna klaar</p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {featuredInProgress.map((badge) => {
                    const progressPercent = toPercent(badge.progressValue, badge.progressTarget);
                    return (
                      <li
                        key={badge.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                      >
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">
                          {badge.badgeName}
                        </h3>
                        <p className="mt-1 text-base leading-relaxed text-[var(--muted)]">
                          {badge.badgeDescription}
                        </p>
                        <div
                          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--background)]"
                          role="progressbar"
                          aria-valuenow={progressPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${badge.badgeName}: ${badge.progressValue} van ${badge.progressTarget}`}
                        >
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {badge.progressValue} van {badge.progressTarget}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {remainingInProgress.length > 0 ? (
              <details className="mt-6">
                <summary className="cursor-pointer text-base font-semibold text-[var(--accent)] hover:underline">
                  Nog {remainingInProgress.length} andere badges
                </summary>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {remainingInProgress.map((badge) => {
                    const progressPercent = toPercent(badge.progressValue, badge.progressTarget);
                    return (
                      <li
                        key={badge.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                      >
                        <h3 className="font-semibold text-[var(--foreground)]">{badge.badgeName}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                          {badge.badgeDescription}
                        </p>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {badge.progressValue} van {badge.progressTarget} ({progressPercent}%)
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </section>

      {passport.domainProgress.length > 0 ? (
        <section className="mt-10" aria-labelledby="domein-heading">
          <h2 id="domein-heading" className="text-2xl font-semibold text-[var(--foreground)]">
            Voortgang per hobby
          </h2>
          <p className="mt-1 text-base text-[var(--muted)]">
            Gebaseerd op wat je bekijkt, bewaart en afrondt.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {passport.domainProgress.map((domain) => (
              <li key={domain.domainId} className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/${domain.domainSlug}`}
                    className="text-lg font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
                  >
                    {domain.domainName}
                  </Link>
                  <span className="text-base font-semibold tabular-nums text-[var(--accent)]">
                    {domain.progressPercent}%
                  </span>
                </div>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--background)]"
                  role="progressbar"
                  aria-valuenow={domain.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${domain.domainName}: ${domain.progressPercent} procent`}
                >
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${domain.progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {domain.signalCount} activiteiten
                  {domain.completionCount > 0
                    ? `, ${domain.completionCount} afgerond`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 grid gap-8 border-t border-[var(--border)] pt-8 lg:grid-cols-2">
        <section aria-labelledby="favorieten-overzicht-heading">
          <h2
            id="favorieten-overzicht-heading"
            className="text-xl font-semibold text-[var(--foreground)]"
          >
            Favorieten per soort
          </h2>
          {favoriteTypesWithCount.length === 0 ? (
            <p className="mt-3 text-base text-[var(--muted)]">Nog geen favorieten bewaard.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {favoriteTypesWithCount.map((type) => (
                <li
                  key={type}
                  className="flex items-center justify-between gap-3 text-base"
                >
                  <span className="text-[var(--muted)]">{FAVORITE_LABELS[type]}</span>
                  <span className="font-semibold tabular-nums text-[var(--foreground)]">
                    {passport.favoritesSummary.byType[type]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/favorites"
            className="mt-4 inline-block text-base font-semibold text-[var(--accent)] hover:underline"
          >
            Volledige favorietenlijst
          </Link>
        </section>

        <section aria-labelledby="recente-activiteit-heading">
          <h2
            id="recente-activiteit-heading"
            className="text-xl font-semibold text-[var(--foreground)]"
          >
            Recente activiteit
          </h2>
          {passport.recentActivities.length === 0 ? (
            <p className="mt-3 text-base text-[var(--muted)]">Nog geen recente activiteiten.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {passport.recentActivities.slice(0, 5).map((activity) => (
                <li key={activity.id} className="border-b border-[var(--border)] pb-3 last:border-0">
                  <p className="font-medium text-[var(--foreground)]">
                    {EVENT_LABELS[activity.eventName] ?? activity.eventName}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {formatDate(activity.occurredAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 9. Location preferences last */}
      <section
        id="locatie"
        className="mt-10 scroll-mt-24 border-t border-[var(--border)] pt-8"
        aria-labelledby="locatie-heading"
      >
        <h2 id="locatie-heading" className="text-xl font-semibold text-[var(--foreground)]">
          Jouw locatie
        </h2>
        <p className="mt-1 max-w-[65ch] text-base leading-relaxed text-[var(--muted)]">
          {locationPreference.label
            ? `Nu ingesteld op ${locationPreference.label}. Gebruikt voor aanbevelingen en evenementen bij jou in de buurt.`
            : "Stel je stad in voor aanbevelingen en evenementen bij jou in de buurt."}
        </p>
        <form
          action={updateLocationPreferenceAction}
          className="mt-5 flex flex-wrap items-end gap-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Stad</span>
            <input
              type="text"
              name="city"
              defaultValue={locationPreference.city ?? ""}
              placeholder="bv. Antwerpen"
              className="min-h-11 w-44 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-base text-[var(--foreground)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              Landcode
            </span>
            <input
              type="text"
              name="country_code"
              defaultValue={locationPreference.countryCode ?? ""}
              placeholder="BE"
              className="min-h-11 w-24 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-base text-[var(--foreground)]"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 text-base font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
          >
            Opslaan
          </button>
        </form>
        {locationPreference.hasPreference ? (
          <form action={clearLocationPreferenceAction} className="mt-3">
            <button
              type="submit"
              className="text-base text-[var(--muted)] hover:text-[var(--accent)] hover:underline"
            >
              Locatie wissen
            </button>
          </form>
        ) : null}
      </section>
    </PageLayout>
  );
}
