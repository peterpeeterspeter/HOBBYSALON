import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Palette, Presentation, Plus } from "lucide-react";
import { getDashboardContext, loadOfferList } from "@/lib/dashboard/load";
import { Button } from "@/components/ui/button";
import {
  DashboardPageHeader,
  EmptyBlock,
  FlashMessage,
  StatusPill,
} from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

type Props = {
  searchParams: Promise<{ soort?: string; success?: string; error?: string }>;
};

const KIND_LABEL = {
  creatie: "Creatie",
  workshop: "Workshop",
  event: "Event",
} as const;

const NEW_HREF = {
  creaties: "/dashboard/products/nieuw",
  workshops: "/dashboard/workshops/nieuw",
  events: "/dashboard/events/nieuw",
} as const;

const NEW_ICON = {
  creaties: Palette,
  workshops: Presentation,
  events: CalendarDays,
} as const;

const NEW_HELP = {
  creaties: "Iets wat je zelf maakte of materiaal dat je niet meer gebruikt.",
  workshops: "Een les of cursus die mensen bij jou kunnen boeken.",
  events: "Een markt, beurs of andere activiteit die je organiseert.",
} as const;

export default async function OfferOverviewPage({ searchParams }: Props) {
  const { soort, success, error } = await searchParams;
  const { creator, caps, offerSections } = await getDashboardContext("/dashboard/aanbod");

  if (offerSections.length === 0) {
    redirect("/dashboard");
  }

  if (!creator) {
    return (
      <div>
        <DashboardPageHeader title="Mijn aanbod" />
        <EmptyBlock title="Maak eerst je maker-pagina">
          <p>Zonder maker-pagina kunnen bezoekers je aanbod niet vinden.</p>
          <Button asChild size="lg" className="mt-4">
            <Link href="/dashboard/pagina">Maker-pagina maken</Link>
          </Button>
        </EmptyBlock>
      </div>
    );
  }

  const items = await loadOfferList({
    creatorId: creator.id,
    includeCreations: caps.canManageProducts,
    includeWorkshops: caps.canDraftWorkshops,
    includeEvents: caps.canDraftEvents,
    canPublishWorkshops: caps.canPublishWorkshops,
    canPublishEvents: caps.canPublishEvents,
  });

  const filterKind =
    soort === "creaties" ? "creatie" : soort === "workshops" ? "workshop" : soort === "events" ? "event" : null;
  const visibleItems = filterKind ? items.filter((item) => item.kind === filterKind) : items;
  const singleSection = offerSections.length === 1 ? offerSections[0] : null;

  const filters = [
    { key: null, label: "Alles", count: items.length },
    ...offerSections.map((section) => ({
      key: section.key,
      label: section.label,
      count: items.filter(
        (item) =>
          item.kind ===
          (section.key === "creaties" ? "creatie" : section.key === "workshops" ? "workshop" : "event")
      ).length,
    })),
  ];

  return (
    <div>
      <DashboardPageHeader
        title="Mijn aanbod"
        lead="Alles wat je op Hobbysalon aanbiedt, op één plek."
        action={
          singleSection ? (
            <Button asChild size="lg">
              <Link href={NEW_HREF[singleSection.key]}>
                <Plus size={22} aria-hidden="true" />
                Toevoegen
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <a href="#toevoegen">
                <Plus size={22} aria-hidden="true" />
                Toevoegen
              </a>
            </Button>
          )
        }
      />

      <FlashMessage success={success} error={error} />

      {offerSections.length > 1 ? (
        <nav aria-label="Filter op soort" className="mb-6 flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = (filter.key ?? null) === (soort && filterKind ? soort : null);
            return (
              <Link
                key={filter.label}
                href={filter.key ? `/dashboard/aanbod?soort=${filter.key}` : "/dashboard/aanbod"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-12 items-center gap-2 rounded-full border px-5 text-lg font-semibold",
                  active
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border-strong)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--foreground)]"
                )}
              >
                {filter.label}
                <span className={active ? "opacity-80" : "text-[var(--muted)]"}>{filter.count}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {visibleItems.length === 0 ? (
        <EmptyBlock title="Nog niets toegevoegd">
          Voeg je eerste aanbod toe. Je kan het eerst als concept bewaren en later zichtbaar
          maken.
        </EmptyBlock>
      ) : (
        <ul className="grid gap-4">
          {visibleItems.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="aspect-square w-28 overflow-hidden rounded-xl bg-[var(--section-alt)]">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-[var(--muted)]">{KIND_LABEL[item.kind]}</p>
                <p className="text-xl font-bold text-[var(--foreground)]">{item.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <StatusPill status={item.status} />
                  {item.detail ? (
                    <span className="text-lg text-[var(--muted)]">{item.detail}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 sm:justify-end">
                <Button asChild size="lg">
                  <Link href={item.editHref}>Bewerken</Link>
                </Button>
                {item.publicHref ? (
                  <Button asChild variant="secondary" size="lg">
                    <Link href={item.publicHref} target="_blank" rel="noopener noreferrer">
                      Bekijken
                    </Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!singleSection ? (
        <section id="toevoegen" className="mt-12 scroll-mt-24" aria-labelledby="toevoegen-titel">
          <h2 id="toevoegen-titel" className="mb-4 text-2xl font-bold text-[var(--foreground)]">
            Wat wil je toevoegen?
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {offerSections.map((section) => {
              const Icon = NEW_ICON[section.key];
              return (
                <li key={section.key}>
                  <Link
                    href={NEW_HREF[section.key]}
                    className="flex h-full min-h-32 items-start gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--accent)]"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--section-alt)] text-[var(--accent-hover)]">
                      <Icon size={26} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-xl font-bold text-[var(--foreground)]">
                        {section.key === "creaties"
                          ? "Een creatie"
                          : section.key === "workshops"
                            ? "Een workshop"
                            : "Een event"}
                      </span>
                      <span className="mt-1 block text-lg text-[var(--muted)]">
                        {NEW_HELP[section.key]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
