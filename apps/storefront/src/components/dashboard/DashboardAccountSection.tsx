import { updateCreatorTypesAction } from "@/app/actions/dashboard";
import { RoleUpgradeSection } from "@/components/auth/RoleUpgradeSection";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_ROLE_DESCRIPTIONS,
  ACCOUNT_ROLE_LABELS,
  sortAccountRoles,
} from "@/lib/auth/account-roles";
import {
  hasPendingRoleRequest,
  privilegedRoleLabel,
} from "@/lib/auth/role-request-status";
import { CREATOR_TYPES } from "@/components/dashboard/creator/types";
import type { Creator } from "@/types/platform";
import type { UserRegistrationContext } from "@/lib/platform/queries/user-registration";

type DashboardAccountSectionProps = {
  userEmail: string | null | undefined;
  registrationContext: UserRegistrationContext;
  creator: Creator | null;
};

export function DashboardAccountSection({
  userEmail,
  registrationContext,
  creator,
}: DashboardAccountSectionProps) {
  const sortedRoles = sortAccountRoles(registrationContext.roles);
  const pendingRequests = registrationContext.pendingRoleRequests;
  const pendingWorkshopHost = hasPendingRoleRequest(
    pendingRequests,
    "workshop_host"
  );
  const pendingOrganizer = hasPendingRoleRequest(pendingRequests, "organizer");
  const selectedCreatorTypes = new Set(creator?.creator_types ?? []);

  return (
    <section id="account" className="scroll-mt-24 space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Account</h2>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Rollen beheren. Wat je hier kiest bepaalt welke menu&apos;s je in het
          dashboard ziet.
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ingelogd als {userEmail ?? "account"}
        </p>
      </header>

      <CardShell variant="default" padding="lg" className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Actieve rollen
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Dit bepaalt wat je in het dashboard ziet.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {sortedRoles.map((role) => (
            <li
              key={role}
              className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
              title={ACCOUNT_ROLE_DESCRIPTIONS[role]}
            >
              {ACCOUNT_ROLE_LABELS[role]}
            </li>
          ))}
          {pendingRequests
            .filter((request) => request.status === "pending")
            .map((request) => (
              <li
                key={request.id}
                className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900"
              >
                {privilegedRoleLabel(request.role)} · in behandeling
              </li>
            ))}
        </ul>
        {pendingRequests.some((request) => request.status === "pending") ? (
          <p className="text-sm text-[var(--muted)]">
            Je aanvraag staat klaar voor beoordeling. Je krijgt toegang zodra we
            die goedkeuren.
          </p>
        ) : null}
      </CardShell>

      <CardShell variant="default" padding="lg" className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Wat doe je op Hobbysalon?
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Kies wat bij je past. Workshopgever en organisator vereisen
            goedkeuring door Hobbysalon.
          </p>
        </div>

        {pendingWorkshopHost || pendingOrganizer ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {[
              pendingWorkshopHost ? "Workshopgever" : null,
              pendingOrganizer ? "Organisator" : null,
            ]
              .filter(Boolean)
              .join(" en ")}{" "}
            wacht op goedkeuring.
          </p>
        ) : null}

        {creator ? (
          <>
            <form action={updateCreatorTypesAction} className="space-y-4">
              <div className="space-y-2">
                {CREATOR_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      name="creator_types"
                      value={type.value}
                      defaultChecked={
                        selectedCreatorTypes.size > 0
                          ? selectedCreatorTypes.has(type.value)
                          : type.value === "maker"
                      }
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-[var(--foreground)]">
                        {type.label}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {type.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <Button type="submit">Rollen opslaan</Button>
            </form>
            <RoleUpgradeSection
              roles={registrationContext.roles}
              creatorTypes={creator.creator_types}
              hasCreatorProfile
              pendingRoleRequests={pendingRequests}
              title="Nog een rol toevoegen?"
              lead="Wil je ook materialen verkopen via een winkelaccount? Start hieronder."
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4"
              showEmptyState={false}
            />
          </>
        ) : (
          <RoleUpgradeSection
            roles={registrationContext.roles}
            creatorTypes={null}
            hasCreatorProfile={false}
            pendingRoleRequests={pendingRequests}
            title="Aanbieder worden"
            lead="Kies een rol om je makerprofiel in te stellen. Je kunt later altijd uitbreiden."
            className="space-y-3"
            showEmptyState
          />
        )}
      </CardShell>
    </section>
  );
}
