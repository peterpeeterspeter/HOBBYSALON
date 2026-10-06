import Link from "next/link";
import { CalendarDays, Package, Presentation, Sparkles } from "lucide-react";
import {
  getAccountRegistrationHref,
  type AccountRegistrationType,
} from "@/lib/auth/account-paths";

type AccountChoiceCardsProps = {
  nextPath?: string | null;
  current?: AccountRegistrationType;
  title?: string;
  lead?: string;
};

const CHOICES: Array<{
  type: AccountRegistrationType;
  title: string;
  description: string;
  icon: typeof Presentation;
}> = [
  {
    type: "workshopgever",
    title: "Workshops geven",
    description:
      "Maak je eigen profiel, publiceer workshops en ontvang aanvragen van geïnteresseerden.",
    icon: Presentation,
  },
  {
    type: "maker",
    title: "Mijn creaties, tutorials of patronen delen",
    description:
      "Toon wat je maakt of deel je kennis, en laat hobbyisten je werk ontdekken.",
    icon: Sparkles,
  },
  {
    type: "organizer",
    title: "Een markt of evenement organiseren",
    description:
      "Publiceer je markt, beurs of creatief evenement in de Hobbysalon-agenda.",
    icon: CalendarDays,
  },
  {
    type: "merchant",
    title: "Mijn winkel of materialen aanbieden",
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
  title = "Wil je zelf iets aanbieden?",
  lead = "Kies wat bij jou past. Je kunt later altijd iets toevoegen.",
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
          {title}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
          {lead}
        </p>
      </div>

      <div className="grid gap-3">
        {visibleChoices.map(({ type, title: choiceTitle, description, icon: Icon }) => (
          <Link
            key={type}
            href={getAccountRegistrationHref(type, nextPath)}
            className="group flex min-h-[5.5rem] items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 transition hover:border-[var(--accent)] hover:bg-[var(--section-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <Icon size={22} aria-hidden="true" />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">
                {choiceTitle}
              </span>
              <span className="mt-1 block text-base leading-relaxed text-[var(--muted)]">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {current && current !== "member" && current !== "aanbieder" && (
        <p className="mt-4 text-base text-[var(--muted)]">
          Liever eerst een gratis account?{" "}
          <Link
            href={getAccountRegistrationHref("member", nextPath)}
            className="font-semibold text-[var(--accent)] underline underline-offset-4"
          >
            Maak je Hobbysalon-account
          </Link>
          .
        </p>
      )}
    </section>
  );
}
