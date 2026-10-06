import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Mail, Store } from "lucide-react";
import { createPlatformClient } from "@/lib/platform/client";
import { getCreatorProgressSteps } from "@/lib/dashboard/creator-progress";
import {
  formatDashboardDate,
  getDashboardContext,
  loadInbox,
  loadUpcoming,
} from "@/lib/dashboard/load";
import { buildReplyMailto, inboxSourceLabel } from "@/lib/dashboard/offer-status";
import { updateInboxItemStatusAction } from "@/app/actions/dashboard-inbox";
import { Button } from "@/components/ui/button";
import {
  DashboardNotice,
  DashboardPageHeader,
  EmptyBlock,
  FlashMessage,
} from "@/components/dashboard/ui";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function countRows(
  table: "products" | "workshops" | "events" | "creator_domains" | "articles" | "projects",
  column: string,
  value: string,
  productTypes?: string[]
): Promise<number> {
  const supabase = createPlatformClient();
  let query = supabase.from(table).select("*", { head: true, count: "exact" }).eq(column, value);
  if (productTypes) query = query.in("product_type", productTypes);
  const { count } = await query;
  return count ?? 0;
}

export default async function DashboardTodayPage({ searchParams }: Props) {
  const { success, error } = await searchParams;
  const { user, creator, registrationContext, caps } = await getDashboardContext("/dashboard");

  const firstName = (creator?.display_name ?? "").trim().split(" ")[0];
  const hasInboxSources =
    caps.canManageProducts || caps.canDraftWorkshops || caps.canDraftEvents;

  const [inbox, upcoming, counts] = creator
    ? await Promise.all([
        loadInbox({
          creatorId: creator.id,
          includeCreations: caps.canManageProducts,
          includeWorkshops: caps.canDraftWorkshops,
          includeEvents: caps.canDraftEvents,
          limit: 20,
        }),
        loadUpcoming({
          creatorId: creator.id,
          includeWorkshops: caps.canDraftWorkshops,
          includeEvents: caps.canDraftEvents,
        }),
        Promise.all([
          countRows("creator_domains", "creator_id", creator.id),
          caps.canManageProducts
            ? countRows("products", "creator_id", creator.id, ["handmade", "destash"])
            : Promise.resolve(0),
          caps.canDraftWorkshops
            ? countRows("workshops", "creator_id", creator.id)
            : Promise.resolve(0),
          caps.canDraftEvents
            ? countRows("events", "organizer_creator_id", creator.id)
            : Promise.resolve(0),
          countRows("articles", "author_creator_id", creator.id),
          countRows("projects", "created_by_user_id", user.id),
        ]),
      ])
    : [[], [], [0, 0, 0, 0, 0, 0]];

  const [domainCount, productCount, workshopCount, eventCount, articleCount, projectCount] =
    counts;

  const progressSteps = caps.canViewCreatorPage
    ? getCreatorProgressSteps({
        creator,
        domainCount,
        productCount,
        workshopCount,
        eventCount,
        articleCount,
        projectCount,
      })
    : [];
  const openSteps = progressSteps.filter((step) => !step.done);
  const nextStep = openSteps[0] ?? null;

  const newItems = inbox.filter((item) => item.isNew);
  const recentHandled = inbox.filter((item) => !item.isNew).slice(0, 3);
  const pendingMerchant = registrationContext.pendingRoleRequests.some(
    (request) => request.role === "merchant" && request.status === "pending"
  );

  // Exactly one notice: the single most useful next thing.
  let notice: ReactNode = null;
  if (caps.isHobbyistOnly) {
    notice = (
      <DashboardNotice
        title="Wil je zelf iets aanbieden?"
        action={
          <Button asChild size="lg">
            <Link href="/dashboard/instellingen#aanbieden">Aanbieder worden</Link>
          </Button>
        }
      >
        Als maker, workshopgever, organisator of winkel. Je kiest zelf wat bij je past.
      </DashboardNotice>
    );
  } else if (!creator && caps.canViewCreatorPage) {
    notice = (
      <DashboardNotice
        title="Begin met je maker-pagina"
        action={
          <Button asChild size="lg">
            <Link href="/dashboard/pagina">Maker-pagina maken</Link>
          </Button>
        }
      >
        Vul je naam, je hobby en een korte voorstelling in. Daarna kan je aanbod toevoegen.
      </DashboardNotice>
    );
  } else if (caps.canViewVendorPortalNav && !caps.canAccessVendorPortal) {
    notice = (
      <DashboardNotice
        title={pendingMerchant ? "Je winkel wordt nagekeken" : "Koppel je winkel"}
        action={
          pendingMerchant ? null : (
            <Button asChild size="lg">
              <Link href="/dashboard/winkel">Naar je winkel</Link>
            </Button>
          )
        }
      >
        {pendingMerchant
          ? "We bekijken je aanvraag. Je krijgt een e-mail zodra je kan beginnen."
          : "Koppel je winkel om voorraad, verzending en uitbetalingen te beheren."}
      </DashboardNotice>
    );
  } else if (nextStep) {
    notice = (
      <DashboardNotice
        title={`Volgende stap: ${nextStep.label}`}
        action={
          nextStep.href ? (
            <Button asChild size="lg">
              <Link href={nextStep.href}>Verder</Link>
            </Button>
          ) : null
        }
      >
        Nog {openSteps.length} van {progressSteps.length} stappen tot je pagina volledig is.
      </DashboardNotice>
    );
  }

  return (
    <div>
      <DashboardPageHeader
        title={firstName ? `Dag ${firstName}` : "Vandaag"}
        lead={
          !hasInboxSources
            ? undefined
            : newItems.length === 1
              ? "Er wacht 1 nieuwe aanvraag op je antwoord."
              : newItems.length > 1
                ? `Er wachten ${newItems.length} nieuwe aanvragen op je antwoord.`
                : "Geen nieuwe aanvragen. Alles is bijgewerkt."
        }
      />

      <FlashMessage success={success} error={error} />
      {notice}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {hasInboxSources ? (
          <section aria-labelledby="aanvragen-titel">
            <h2
              id="aanvragen-titel"
              className="mb-4 flex items-center gap-2 text-2xl font-bold text-[var(--foreground)]"
            >
              <Mail size={24} aria-hidden="true" className="text-[var(--accent-hover)]" />
              Aanvragen
            </h2>

            {newItems.length === 0 ? (
              <EmptyBlock title="Geen nieuwe aanvragen">
                Als iemand een vraag stelt of wil boeken, zie je dat hier meteen. Je krijgt ook
                een e-mail.
              </EmptyBlock>
            ) : (
              <ul className="space-y-4">
                {newItems.map((item) => (
                  <li
                    key={`${item.source}-${item.id}`}
                    className="rounded-2xl border-2 border-[var(--accent)]/40 bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]"
                  >
                    <p className="text-base font-semibold text-[var(--accent-hover)]">
                      {inboxSourceLabel(item.source)}
                    </p>
                    <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                      {item.name || item.email}
                    </p>
                    <p className="text-lg text-[var(--muted)]">
                      Over {item.subject}, {formatDashboardDate(item.createdAt)}
                    </p>
                    {item.message ? (
                      <p className="mt-3 max-w-[65ch] whitespace-pre-wrap text-lg leading-relaxed text-[var(--foreground)]">
                        {item.message}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button asChild size="lg">
                        <a href={buildReplyMailto(item)}>Antwoorden per e-mail</a>
                      </Button>
                      <form action={updateInboxItemStatusAction}>
                        <input type="hidden" name="source" value={item.source} />
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="contacted" />
                        <Button type="submit" variant="secondary" size="lg">
                          Behandeld
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {recentHandled.length > 0 ? (
              <div className="mt-8">
                <h3 className="mb-3 text-xl font-semibold text-[var(--foreground)]">
                  Eerder behandeld
                </h3>
                <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                  {recentHandled.map((item) => (
                    <li
                      key={`${item.source}-${item.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <span className="text-lg text-[var(--foreground)]">
                        {item.name || item.email}
                        <span className="text-[var(--muted)]"> over {item.subject}</span>
                      </span>
                      <a
                        href={buildReplyMailto(item)}
                        className="text-lg font-semibold text-[var(--accent-hover)] underline underline-offset-4"
                      >
                        E-mailen
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        <aside className="space-y-6">
          {upcoming.length > 0 ? (
            <section
              aria-labelledby="binnenkort-titel"
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <h2
                id="binnenkort-titel"
                className="mb-3 flex items-center gap-2 text-xl font-bold text-[var(--foreground)]"
              >
                <CalendarDays size={22} aria-hidden="true" className="text-[var(--accent-hover)]" />
                Binnenkort
              </h2>
              <ul className="space-y-3">
                {upcoming.map((row) => (
                  <li key={row.id}>
                    <Link href={row.href} className="group block">
                      <span className="block text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--accent-hover)]">
                        {row.title}
                      </span>
                      <span className="block text-base text-[var(--muted)]">
                        {row.kind}, {formatDashboardDate(row.startsAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {caps.canAccessVendorPortal ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-[var(--foreground)]">
                <Store size={22} aria-hidden="true" className="text-[var(--accent-hover)]" />
                Winkel
              </h2>
              <p className="text-lg text-[var(--muted)]">Bestellingen, voorraad en verzending.</p>
              <Button asChild variant="secondary" className="mt-4">
                <Link href="/dashboard/winkel">Naar je winkel</Link>
              </Button>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
