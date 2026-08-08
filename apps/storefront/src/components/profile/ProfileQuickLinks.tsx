import Link from "next/link";
import { ACCOUNT_NAV, resolveAanbodNav } from "@/config/nav";

type ProfileQuickLinksProps = {
  showMakerLink: boolean;
  hasLocation: boolean;
  hasCreatorProfile: boolean;
  hasOfferIntent: boolean;
  hasMerchantAccess?: boolean;
  primaryOfferLabel?: string | null;
};

const linkClassName =
  "inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-base font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2";

export function ProfileQuickLinks({
  showMakerLink,
  hasLocation,
  hasCreatorProfile,
  hasOfferIntent,
  hasMerchantAccess = false,
  primaryOfferLabel,
}: ProfileQuickLinksProps) {
  const aanbod = resolveAanbodNav({
    hasCreatorProfile,
    hasOfferIntent,
    hasMerchantAccess,
  });

  return (
    <nav aria-label="Snel naar" className="mt-6 space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Mijn Hobbysalon
        </p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href="#bewaarde-ideeen" className={linkClassName}>
              Bewaarde ideeën
            </Link>
          </li>
          <li>
            <Link href="/profile/projects" className={linkClassName}>
              Projecten
            </Link>
          </li>
          <li>
            <Link href="/favorites" className={linkClassName}>
              Favorieten
            </Link>
          </li>
          <li>
            <Link href={hasLocation ? "#dichtbij" : "#locatie"} className={linkClassName}>
              Dichtbij
            </Link>
          </li>
        </ul>
      </div>

      {aanbod ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Mijn aanbod
          </p>
          <ul className="flex flex-wrap gap-2">
            {showMakerLink ? (
              <li>
                <Link href="#maker-pagina" className={linkClassName}>
                  {primaryOfferLabel
                    ? `${primaryOfferLabel}profiel`
                    : "Mijn profiel"}
                </Link>
              </li>
            ) : null}
            <li>
              <Link href={aanbod.href} className={linkClassName}>
                {aanbod.label}
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

/** Re-export for callers that still need the account home link. */
export { ACCOUNT_NAV };
