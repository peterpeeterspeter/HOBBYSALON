import Link from "next/link";
import { ACCOUNT_NAV } from "@/config/nav";

type ProfileQuickLinksProps = {
  showMakerLink: boolean;
  hasLocation: boolean;
};

const linkClassName =
  "inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-base font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2";

export function ProfileQuickLinks({ showMakerLink, hasLocation }: ProfileQuickLinksProps) {
  return (
    <nav aria-label="Snel naar" className="mt-6">
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href="#bewaarde-ideeen" className={linkClassName}>
            Bewaarde ideeën
          </Link>
        </li>
        <li>
          <Link href="/profile/projects" className={linkClassName}>
            Mijn projecten
          </Link>
        </li>
        <li>
          <Link href="/favorites" className={linkClassName}>
            Alle favorieten
          </Link>
        </li>
        <li>
          <Link href={hasLocation ? "#dichtbij" : "#locatie"} className={linkClassName}>
            Dichtbij
          </Link>
        </li>
        {showMakerLink ? (
          <li>
            <Link href="#maker-pagina" className={linkClassName}>
              Makerpagina
            </Link>
          </li>
        ) : null}
        <li>
          <Link href={ACCOUNT_NAV.pro.href} className={linkClassName}>
            {ACCOUNT_NAV.pro.label}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
