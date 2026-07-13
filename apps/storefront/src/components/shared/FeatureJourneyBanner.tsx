import Link from "next/link";
import { BookOpen, ClipboardCheck, MapPin, PackageCheck } from "lucide-react";
import { CardShell } from "@/components/ui/card-shell";

type FeatureJourneyBannerProps = {
  context: "home" | "profile";
};

const FEATURES = [
  {
    icon: BookOpen,
    title: "Bewaar inspiratie",
    body: "Al je patronen, artikels en workshops netjes bij elkaar.",
  },
  {
    icon: ClipboardCheck,
    title: "Maak stap voor stap",
    body: "Start een project, vink af wat je hebt en noteer wat je leert.",
  },
  {
    icon: PackageCheck,
    title: "Ken je materialenkast",
    body: "Nooit meer dubbel wol kopen. Zie in één oogopslag wat je al in huis hebt.",
  },
  {
    icon: MapPin,
    title: "Ontdek dichtbij",
    body: "Creatieve events in jouw buurt, zonder zoeken.",
  },
];

export function FeatureJourneyBanner({ context }: FeatureJourneyBannerProps) {
  const isHome = context === "home";
  return (
    <CardShell variant="featured" padding="lg" className="overflow-hidden bg-[var(--section-highlight)]">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-[var(--accent)]">Jouw creatieve plek</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Meer dan inspiratie alleen.
          </h2>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
            Van &apos;ooit eens proberen&apos; naar &apos;dit weekend maken&apos;. Bewaar, plan en pak je
            projecten weer op — in je eigen tempo.
          </p>
          <Link
            href={isHome ? "/register" : "/favorites"}
            className="mt-5 inline-flex min-h-12 items-center rounded-md bg-[var(--accent)] px-5 text-base font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
          >
            {isHome ? "Maak je gratis profiel" : "Bekijk mijn bewaarde ideeën"}
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <Icon size={22} aria-hidden="true" className="text-[var(--accent)]" />
              <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}
