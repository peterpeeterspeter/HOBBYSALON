import Link from "next/link";
import { Heart, Package, Palette } from "lucide-react";
import { getAccountRegistrationHref, type AccountRegistrationType } from "@/lib/auth/account-paths";

type AccountChoiceCardsProps = { nextPath?: string | null; current?: AccountRegistrationType };

const CHOICES: Array<{
  type: AccountRegistrationType;
  title: string;
  description: string;
  icon: typeof Heart;
}> = [
  { type: "member", title: "Ik kom inspiratie opdoen", description: "Bewaar ideeën, start projecten en vind workshops en materialen.", icon: Heart },
  { type: "creator", title: "Ik maak, geef les of organiseer", description: "Beheer je profiel, workshops, events en creatieve aanbod.", icon: Palette },
  { type: "merchant", title: "Ik verkoop hobbymaterialen", description: "Importeer je catalogus en beheer je materialenverkoop.", icon: Package },
];

export function AccountChoiceCards({ nextPath, current }: AccountChoiceCardsProps) {
  return (
    <section aria-labelledby="account-choice-title" className="mt-7">
      <div className="mb-3">
        <h2 id="account-choice-title" className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">Wat wil je doen op Hobbysalon?</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Kies de registratie die bij je past. Je kunt later altijd uitbreiden.</p>
      </div>
      <div className="grid gap-3">
        {CHOICES.filter((choice) => choice.type !== current).map(({ type, title, description, icon: Icon }) => (
          <Link key={type} href={getAccountRegistrationHref(type, nextPath)} className="group flex min-h-20 items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent)] hover:bg-[var(--section-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]"><Icon size={21} aria-hidden="true" /></span>
            <span className="min-w-0"><span className="block font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">{title}</span><span className="mt-0.5 block text-sm leading-snug text-[var(--muted)]">{description}</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
