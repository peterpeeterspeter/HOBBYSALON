import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { isModerator } from "@/lib/platform/queries/community-showcase";
import { listPendingRoleRequests } from "@/lib/platform/queries/role-requests";
import { moderateRoleRequestAction } from "@/app/actions/role-requests";
import { ACCOUNT_ROLE_LABELS } from "@/lib/auth/account-roles";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function RoleModerationPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/dashboard/moderatie/roles");
  if (!(await isModerator(user.id))) redirect("/dashboard");

  const { success, error } = await searchParams;
  const requests = await listPendingRoleRequests();

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">
          Moderatie
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          Rolaanvragen
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Keur merchant-, workshopgever- en organisator-aanvragen goed of af.
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

      {requests.length === 0 ? (
        <CardShell variant="default" padding="lg">
          <p>Geen rolaanvragen wachten op beoordeling.</p>
        </CardShell>
      ) : (
        requests.map((request) => {
          const payload = request.payload ?? {};
          return (
            <CardShell key={request.id} variant="default" padding="lg">
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Aangevraagd op{" "}
                  {new Intl.DateTimeFormat("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(request.created_at))}
                </p>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  {ACCOUNT_ROLE_LABELS[request.role]}
                </h2>
                <ul className="space-y-1 text-sm text-[var(--foreground)]">
                  <li>
                    <span className="text-[var(--muted)]">E-mail:</span>{" "}
                    {request.userEmail ?? payload.email ?? "—"}
                  </li>
                  {payload.displayName ? (
                    <li>
                      <span className="text-[var(--muted)]">Naam:</span>{" "}
                      {payload.displayName}
                    </li>
                  ) : null}
                  {payload.city ? (
                    <li>
                      <span className="text-[var(--muted)]">Stad:</span>{" "}
                      {payload.city}
                    </li>
                  ) : null}
                  {payload.source ? (
                    <li>
                      <span className="text-[var(--muted)]">Bron:</span>{" "}
                      {payload.source}
                    </li>
                  ) : null}
                </ul>

                <form action={moderateRoleRequestAction} className="mt-4 space-y-3">
                  <input type="hidden" name="request_id" value={request.id} />
                  <textarea
                    name="reviewer_note"
                    rows={2}
                    placeholder="Notitie (optioneel)"
                    className="w-full rounded-lg border border-[var(--border)] p-3"
                  />
                  <div className="flex gap-3">
                    <Button name="status" value="approved" type="submit">
                      Goedkeuren
                    </Button>
                    <Button name="status" value="rejected" type="submit" variant="secondary">
                      Afwijzen
                    </Button>
                  </div>
                </form>
              </div>
            </CardShell>
          );
        })
      )}
    </section>
  );
}
