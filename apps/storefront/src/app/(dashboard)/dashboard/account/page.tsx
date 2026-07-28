import Link from "next/link";
import { redirect } from "next/navigation";
import { updateCreatorTypesAction } from "@/app/actions/dashboard";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
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

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function DashboardAccountPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/account");
  }

  const [registrationContext, creator] = await Promise.all([
    getUserRegistrationContext(user.id),
    getCreatorByUserId(user.id),
  ]);

  const sortedRoles = sortAccountRoles(registrationContext.roles);
  const pendingRequests = registrationContext.pendingRoleRequests;
  const pendingWorkshopHost = hasPendingRoleRequest(
    pendingRequests,
    "workshop_host"
  );
  const pendingOrganizer = hasPendingRoleRequest(pendingRequests, "organizer");
  const selectedCreatorTypes = new Set(creator?.creator_types ?? []);
  const { success, error } = await searchParams;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Account</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Rollen beheren. Wat je hier kiest bepaalt welke menu&apos;s je in het
          dashboard ziet.
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ingelogd als {user.email ?? "account"}
        </p>
      </header>

      {success && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <CardShell variant="default" padding="lg" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Actieve rollen</h2>
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
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Wat doe je op Hobbysalon?
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Kies wat bij je past. Workshopgever en organisator vereisen
            goedkeuring door Hobbysalon.
          </p>
        </div>

        {(pendingWorkshopHost || pendingOrganizer) && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {[
              pendingWorkshopHost ? "Workshopgever" : null,
              pendingOrganizer ? "Organisator" : null,
            ]
              .filter(Boolean)
              .join(" en ")}{" "}
            wacht op goedkeuring.
          </p>
        )}

        {creator ? (
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
                    <span className="block text-xs text-[var(--muted)]">{type.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <Button type="submit">Rollen opslaan</Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Maak eerst je maker-pagina aan. Daarna kies je hier of je maker, workshopgever,
              leverancier, contentmaker of organisator bent.
            </p>
            <Button asChild size="sm">
              <Link href="/profile?tab=profiel#maker-pagina">Makerprofiel aanmaken</Link>
            </Button>
          </div>
        )}
      </CardShell>
    </section>
  );
}
