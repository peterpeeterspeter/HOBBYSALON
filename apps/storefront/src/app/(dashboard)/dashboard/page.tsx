import Link from "next/link";
import { redirect } from "next/navigation";
import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { getCreatorProgressSteps } from "@/lib/dashboard/creator-progress";
import { countNewProductInquiries } from "@/lib/platform/queries/product-inquiries";
import { GridLayout } from "@/components/layout/grid-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { DashboardAccountSection } from "@/components/dashboard/DashboardAccountSection";

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

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function DashboardHomePage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { success, error } = await searchParams;

  const [creator, registrationContext] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
  ]);

  const caps = resolveDashboardCapabilities({
    registrationContext,
    creatorTypes: creator?.creator_types,
    hasCreatorProfile: Boolean(creator),
  });

  const [productCount, workshopCount, eventCount, domainCount, articleCount, projectCount, newInquiryCount] =
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
          caps.canManageProducts
            ? countNewProductInquiries(creator.id)
            : Promise.resolve(0),
        ])
      : [0, 0, 0, 0, 0, 0, 0];

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

      {success ? (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {newInquiryCount > 0 ? (
        <CardShell
          variant="featured"
          padding="lg"
          className="border-amber-300 bg-amber-50"
        >
          <p className="text-lg font-semibold text-amber-950">
            {newInquiryCount === 1
              ? "1 nieuwe aanvraag op je plaatsingen"
              : `${newInquiryCount} nieuwe aanvragen op je plaatsingen`}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-amber-900/80">
            Iemand wil contact over een van je creaties. Open de inbox, stuur een
            antwoord via e-mail en markeer de aanvraag als behandeld.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/dashboard/products#aanvragen">Open aanvragen</Link>
            </Button>
          </div>
        </CardShell>
      ) : null}

      {caps.isHobbyistOnly ? (
        <CardShell variant="featured" padding="lg" className="border-[var(--accent)]/30">
          <p className="text-lg font-semibold text-[var(--foreground)]">
            Jouw hobby-account
          </p>
          <p className="mt-2 max-w-xl leading-relaxed text-[var(--muted)]">
            Pas interesses en locatie aan voor betere aanbevelingen. Wil je later verkopen,
            workshops geven of events organiseren? Dat regel je hieronder onder Account.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="#account">Naar account</Link>
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
              <Link href="#account">Rollen & voorkeuren</Link>
            </Button>
          </div>
        </CardShell>
      ) : caps.canViewVendorPortalNav && !caps.canAccessVendorPortal ? (
        <CardShell variant="featured" padding="lg" className="border-[var(--accent)]/30">
          <p className="text-lg font-semibold text-[var(--foreground)]">Verkopersportaal</p>
          <p className="mt-2 max-w-xl leading-relaxed text-[var(--muted)]">
            {registrationContext.pendingRoleRequests.some(
              (request) => request.role === "merchant" && request.status === "pending"
            )
              ? "Je merchant-aanvraag wordt beoordeeld. Zodra die is goedgekeurd, beheer je hier voorraad, verzending en uitbetalingen op verkoper.hobbysalon.be."
              : "Je merchant-rol is actief. Zodra je winkel is gekoppeld, open je hier verkoper.hobbysalon.be."}
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/dashboard/verkoper">Naar verkopersportaal</Link>
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
          {caps.canViewVendorPortalNav ? (
            <li>
              <Link
                href="/dashboard/verkoper"
                className="block rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:border-[var(--accent)]"
              >
                <span className="font-medium text-[var(--foreground)]">Verkopersportaal</span>
                <span className="mt-1 block text-[var(--muted)]">
                  {caps.canAccessVendorPortal
                    ? "Voorraad, verzending en uitbetalingen"
                    : "Status en toegang tot je winkel"}
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

      <DashboardAccountSection
        userEmail={user.email}
        registrationContext={registrationContext}
        creator={creator}
      />
    </section>
  );
}
