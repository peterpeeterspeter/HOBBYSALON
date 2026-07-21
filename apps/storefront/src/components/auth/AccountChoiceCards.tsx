import Link from "next/link";
import { CalendarDays, Package, Presentation } from "lucide-react";
import {
  getAccountRegistrationHref,
  type AccountRegistrationType,
} from "@/lib/auth/account-paths";

type AccountChoiceCardsProps = {
  nextPath?: string | null;
  current?: AccountRegistrationType;
};

const CHOICES: Array<{
  type: AccountRegistrationType;
  title: string;
  description: string;
  icon: typeof Presentation;
}> = [
  {
    type: "workshopgever",
    title: "Workshopgever",
    description:
      "Deel je vak, zet je lessen online en ontvang aanvragen van hobbyisten.",
    icon: Presentation,
  },
  {
    type: "merchant",
    title: "Hobbymaterialenverkoper",
    description:
      "Importeer je catalogus en breng je materialen onder de ogen van makers.",
    icon: Package,
  },
  {
    type: "organizer",
    title: "Makersmarkt organisator",
    description:
      "Promoot je markt, beurs of open atelier in dé creatieve agenda.",
    icon: CalendarDays,
  },
];

function shouldHideChoice(
  choice: AccountRegistrationType,
  current?: AccountRegistrationType
): boolean {
  if (!current) return false;
  if (choice === current) return true;

  // Creator registration covers workshop hosts and organizers.
  if (
    current === "creator" &&
    (choice === "workshopgever" || choice === "organizer")
  ) {
    return true;
  }
  if (
    (current === "workshopgever" || current === "organizer") &&
    (choice === "workshopgever" || choice === "organizer" || choice === "creator")
  ) {
    return true;
  }

  return false;
}

export function AccountChoiceCards({
  nextPath,
  current,
}: AccountChoiceCardsProps) {
  const visibleChoices = CHOICES.filter(
    (choice) => !shouldHideChoice(choice.type, current)
  );

  if (visibleChoices.length === 0) return null;

  return (
    <section
      aria-labelledby="account-choice-title"
      className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
    >
      <div className="mb-4 max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Optioneel
        </p>
        <h2
          id="account-choice-title"
          className="mt-1 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]"
        >
          Wat wil je doen op Hobbysalon?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Wil je niet alleen hobbyist zijn? Kies hieronder een extra rol. Je
          kunt later altijd uitbreiden via je account.
        </p>
      </div>

      <div className="grid gap-3">
        {visibleChoices.map(({ type, title, description, icon: Icon }) => (
          <Link
            key={type}
            href={getAccountRegistrationHref(type, nextPath)}
            className="group flex min-h-[5.5rem] items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 transition hover:border-[var(--accent)] hover:bg-[var(--section-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <Icon size={22} aria-hidden="true" />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">
                {title}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {current && current !== "member" && (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Liever eerst als hobbyist starten?{" "}
          <Link
            href={getAccountRegistrationHref("member", nextPath)}
            className="font-medium text-[var(--accent)] underline"
          >
            Maak een hobbyistenaccount
          </Link>
          .
        </p>
      )}
    </section>
  );
}
