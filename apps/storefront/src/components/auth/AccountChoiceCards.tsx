import Link from "next/link";
import { CalendarDays, Package, Presentation, Sparkles } from "lucide-react";
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
      "Maak je eigen profiel, publiceer workshops en ontvang aanvragen van geïnteresseerden.",
    icon: Presentation,
  },
  {
    type: "maker",
    title: "Maker",
    description:
      "Toon je creaties en laat hobbyisten ontdekken wat je maakt.",
    icon: Sparkles,
  },
  {
    type: "organizer",
    title: "Organisator",
    description:
      "Publiceer je markt, beurs of creatief evenement in de Hobbysalon-agenda.",
    icon: CalendarDays,
  },
  {
    type: "merchant",
    title: "Hobbymaterialenverkoper",
    description:
      "Presenteer je winkel en materialen aan een gericht creatief publiek.",
    icon: Package,
  },
];

function shouldHideChoice(
  choice: AccountRegistrationType,
  current?: AccountRegistrationType
): boolean {
  if (!current) return false;
  if (choice === current) return true;

  // Creator registration covers workshop hosts, makers and organizers.
  if (
    (current === "creator" || current === "maker") &&
    (choice === "workshopgever" ||
      choice === "organizer" ||
      choice === "maker" ||
      choice === "creator")
  ) {
    return true;
  }
  if (
    (current === "workshopgever" || current === "organizer") &&
    (choice === "workshopgever" ||
      choice === "organizer" ||
      choice === "creator" ||
      choice === "maker")
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
        <h2
          id="account-choice-title"
          className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]"
        >
          Wil je zelf iets aanbieden?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Eén account kan meerdere rollen hebben. Kies hieronder wat bij jou past.
          Je kunt later altijd uitbreiden via je account.
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
          Liever eerst een gratis account?{" "}
          <Link
            href={getAccountRegistrationHref("member", nextPath)}
            className="font-medium text-[var(--accent)] underline"
          >
            Maak je Hobbysalon-account
          </Link>
          .
        </p>
      )}
    </section>
  );
}
