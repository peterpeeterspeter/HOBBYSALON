import Link from "next/link";
import { CalendarDays, Package, Presentation, Sparkles } from "lucide-react";
import { startOfferRoleUpgradeAction } from "@/app/actions/onboarding";
import { getAccountRegistrationHref } from "@/lib/auth/account-paths";
import {
  listMissingOfferUpgrades,
  type RoleUpgradeCandidate,
} from "@/lib/auth/role-upgrades";
import type { PrivilegedRole } from "@/lib/auth/role-request-status";
import type { UserAccountRole } from "@/lib/platform/queries/user-registration";
import type { RegistrationOfferRole } from "@/lib/auth/registration-options";

type RoleUpgradeSectionProps = {
  roles: UserAccountRole[];
  creatorTypes?: string[] | null;
  hasCreatorProfile: boolean;
  pendingRoleRequests: Array<{ role: PrivilegedRole; status: string }>;
  /** Heading override */
  title?: string;
  lead?: string;
  className?: string;
  /** Show empty state when nothing left to upgrade */
  showEmptyState?: boolean;
};

const ICONS: Record<
  RegistrationOfferRole,
  typeof Presentation
> = {
  workshopgever: Presentation,
  maker: Sparkles,
  organizer: CalendarDays,
  merchant: Package,
};

function UpgradeCard({ candidate }: { candidate: RoleUpgradeCandidate }) {
  const Icon = ICONS[candidate.role];
  const cardClassName =
    "group flex min-h-[5.5rem] w-full items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-left transition hover:border-[var(--accent)] hover:bg-[var(--section-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  const body = (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">
          {candidate.label} worden
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">
          {candidate.description}
        </span>
      </span>
    </>
  );

  if (candidate.kind === "merchant") {
    return (
      <Link
        href={getAccountRegistrationHref("merchant", "/dashboard")}
        className={cardClassName}
      >
        {body}
      </Link>
    );
  }

  return (
    <form action={startOfferRoleUpgradeAction}>
      <input type="hidden" name="offer_role" value={candidate.role} />
      <button type="submit" className={cardClassName}>
        {body}
      </button>
    </form>
  );
}

export function RoleUpgradeSection({
  roles,
  creatorTypes,
  hasCreatorProfile,
  pendingRoleRequests,
  title = "Wil je zelf iets aanbieden?",
  lead = "Breid je account uit. Workshopgever en organisator vereisen goedkeuring door Hobbysalon.",
  className,
  showEmptyState = false,
}: RoleUpgradeSectionProps) {
  const upgrades = listMissingOfferUpgrades({
    roles,
    creatorTypes,
    hasCreatorProfile,
    pendingRoleRequests,
  });

  if (upgrades.length === 0) {
    if (!showEmptyState) return null;
    return (
      <section
        id="rollen-upgraden"
        className={className}
        aria-labelledby="rollen-upgraden-title"
      >
        <p className="text-sm text-[var(--muted)]">
          Je hebt alle beschikbare aanbiedersrollen.
        </p>
      </section>
    );
  }

  return (
    <section
      id="rollen-upgraden"
      aria-labelledby="rollen-upgraden-title"
      className={
        className ??
        "mt-10 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
      }
    >
      <div className="mb-4 max-w-xl">
        <h2
          id="rollen-upgraden-title"
          className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {lead}
        </p>
      </div>

      <div className="grid gap-3">
        {upgrades.map((candidate) => (
          <UpgradeCard key={candidate.role} candidate={candidate} />
        ))}
      </div>
    </section>
  );
}
