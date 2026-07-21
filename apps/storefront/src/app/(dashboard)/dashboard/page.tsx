import Link from "next/link";
import { redirect } from "next/navigation";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { getCreatorProgressSteps } from "@/lib/dashboard/creator-progress";
import { GridLayout } from "@/components/layout/grid-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";

async function getCount(
  table: "products" | "workshops" | "events",
  field: "creator_id" | "organizer_creator_id",
  creatorId: string
): Promise<number> {
  const supabase = createPlatformClient();
  const { count } = await supabase
    .from(table)
    .select("id", { head: true, count: "exact" })
    .eq(field, creatorId);

  return count ?? 0;
}

export default async function DashboardHomePage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard");
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

  const [productCount, workshopCount, eventCount, domainCount, articleCount, projectCount] =
    creator
      ? await Promise.all([
          caps.canManageProducts
            ? getCount("products", "creator_id", creator.id)
            : Promise.resolve(0),
          caps.canManageWorkshops
            ? getCount("workshops", "creator_id", creator.id)
            : Promise.resolve(0),
          caps.canManageEvents
            ? getCount("events", "organizer_creator_id", creator.id)
            : Promise.resolve(0),
          (async () => {
            const supabase = createPlatformClient();
            const { count } = await supabase
              .from("creator_domains")
              .select("domain_id", { head: true, count: "exact" })
              .eq("creator_id", creator.id);
            return count ?? 0;
          })(),
          (async () => {
            const supabase = createPlatformClient();
            const { count } = await supabase
              .from("articles")
              .select("id", { head: true, count: "exact" })
              .eq("author_creator_id", creator.id);
            return count ?? 0;
          })(),
          (async () => {
            const supabase = createPlatformClient();
            const { count } = await supabase
              .from("projects")
              .select("id", { head: true, count: "exact" })
              .eq("created_by_user_id", user.id);
            return count ?? 0;
          })(),
        ])
      : [0, 0, 0, 0, 0, 0];

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
  const incompleteSteps = progressSteps.filter((step) => !step.done);
  const nextStep = incompleteSteps[0] ?? null;

  const offerCards = [
    caps.canManageProducts
      ? {
          key: "products",
          label: "Jouw Shop",
          count: productCount,
          href: "/dashboard/products",
        }
      : null,
    caps.canManageWorkshops
      ? {
          key: "workshops",
          label: "Workshops",
          count: workshopCount,
          href: "/dashboard/workshops",
        }
      : null,
    caps.canManageEvents
      ? {
          key: "events",
          label: "Events",
          count: eventCount,
          href: "/dashboard/events",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    count: number;
    href: string;
  }>;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">
          Overzicht
        </h1>
        <p className="mt-2 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Welkom terug{creator?.display_name ? `, ${creator.display_name}` : ""}.
          Je ziet hier alleen wat bij jouw rollen past.
        </p>
      </header>

      {caps.isHobbyistOnly ? (
        <CardShell variant="featured" padding="lg" className="border-[var(--accent)]/30">
          <p className="text-lg font-semibold text-[var(--foreground)]">
            Jouw hobby-account
          </p>
          <p className="mt-2 max-w-xl leading-relaxed text-[var(--muted)]">
            Pas interesses en locatie aan voor betere aanbevelingen. Wil je later verkopen,
            workshops geven of events organiseren? Dat regel je onder Account.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/dashboard/account">Open Account</Link>
            </Button>
          </div>
        </CardShell>
      ) : !creator && caps.canViewCreatorPage ? (
        <CardShell variant="featured" padding="lg" className="border-[var(--accent)]/30">
          <p className="text-lg font-semibold text-[var(--foreground)]">
            Begin met je maker-pagina
          </p>
          <p className="mt-2 max-w-xl leading-relaxed text-[var(--muted)]">
            Vul je naam, hobby&apos;s en een korte bio in. Daarna zie je de tools die bij jouw
            rollen horen.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/profile?tab=profiel#maker-pagina">Makerprofiel instellen</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard/account">Rollen & voorkeuren</Link>
            </Button>
          </div>
        </CardShell>
      ) : caps.canAccessVendorPortal && !caps.canViewCreatorPage ? (
        <CardShell variant="featured" padding="lg" className="border-[var(--accent)]/30">
          <p className="text-lg font-semibold text-[var(--foreground)]">Je winkel</p>
          <p className="mt-2 max-w-xl leading-relaxed text-[var(--muted)]">
            Beheer voorraad, verzending en uitbetalingen in het verkopersportaal.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/dashboard/verkoper">Open verkopersportaal</Link>
            </Button>
          </div>
        </CardShell>
      ) : nextStep ? (
        <CardShell variant="featured" padding="lg" className="border-[var(--accent)]/30">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            Volgende stap
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{nextStep.label}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {incompleteSteps.length} van {progressSteps.length} stappen nog open.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {nextStep.href ? (
              <Button asChild>
                <Link href={nextStep.href}>Doorgaan</Link>
              </Button>
            ) : null}
            {caps.canViewCreatorPage ? (
              <Button asChild variant="secondary">
                <Link href="/profile#maker-pagina">Jouw makerprofiel</Link>
              </Button>
            ) : null}
          </div>
        </CardShell>
      ) : creator ? (
        <CardShell variant="default" padding="lg">
          <p className="text-lg font-semibold text-[var(--foreground)]">Je bent klaar om te starten</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Gebruik de links hieronder. Rollen wijzig je onder Account.
          </p>
        </CardShell>
      ) : null}

      {offerCards.length > 0 ? (
        <GridLayout cols={3}>
          {offerCards.map((card) => (
            <CardShell key={card.key} variant="default" padding="lg">
              <p className="text-sm font-semibold text-[var(--muted)]">{card.label}</p>
              <p className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">
                {card.count}
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link href={card.href}>Beheren</Link>
              </Button>
            </CardShell>
          ))}
        </GridLayout>
      ) : null}

      <CardShell variant="default" padding="lg">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Snelmenu</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {caps.canViewCreatorPage ? (
            <li>
              <Link
                href="/profile#maker-pagina"
                className="block rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:border-[var(--accent)]"
              >
                <span className="font-medium text-[var(--foreground)]">Jouw makerprofiel</span>
                <span className="mt-1 block text-[var(--muted)]">
                  Maak je publieke makerpagina aan, schrijf artikels en toon je portfolio
                </span>
              </Link>
            </li>
          ) : null}
          <li>
            <Link
              href="/dashboard/account"
              className="block rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:border-[var(--accent)]"
            >
              <span className="font-medium text-[var(--foreground)]">Account</span>
              <span className="mt-1 block text-[var(--muted)]">
                Rollen en voorkeuren
              </span>
            </Link>
          </li>
          {caps.canAccessVendorPortal ? (
            <li>
              <Link
                href="/dashboard/verkoper"
                className="block rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:border-[var(--accent)]"
              >
                <span className="font-medium text-[var(--foreground)]">Verkopersportaal</span>
                <span className="mt-1 block text-[var(--muted)]">
                  Voorraad, verzending en uitbetalingen
                </span>
              </Link>
            </li>
          ) : null}
          {caps.canViewSoughtMaterials ? (
            <li>
              <Link
                href="/dashboard/sought-materials"
                className="block rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:border-[var(--accent)]"
              >
                <span className="font-medium text-[var(--foreground)]">Producten gezocht</span>
                <span className="mt-1 block text-[var(--muted)]">
                  Wat hobbyisten zoeken voor hun projecten
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      </CardShell>
    </section>
  );
}
