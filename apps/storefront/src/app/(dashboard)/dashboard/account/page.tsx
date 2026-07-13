import Link from "next/link";
import { redirect } from "next/navigation";
import {
  onboardMerchantForLoggedInUserAction,
  updateAccountPreferencesAction,
} from "@/app/actions/auth";
import { RegistrationProfileForm } from "@/components/auth/RegistrationProfileForm";
import { MerchantUpgradeForm } from "@/components/auth/MerchantUpgradeForm";
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

  const hasMerchantRole = registrationContext.roles.includes("merchant");
  const hasSellerLink = registrationContext.sellerLinks.length > 0;
  const sortedRoles = sortAccountRoles(registrationContext.roles);
  const { success, error } = await searchParams;

  const creatorTypeLabels = new Map(CREATOR_TYPES.map((type) => [type.value, type.label]));

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Account & rollen</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Pas je rollen en voorkeuren aan wanneer je aanbod verandert. Je kunt later altijd
          workshopgever, organisator of winkel worden.
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

      <CardShell variant="default" padding="lg">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Je huidige rollen</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ingelogd als <strong>{user.email ?? "account"}</strong>
        </p>
        <ul className="mt-4 space-y-3">
          {sortedRoles.map((role) => (
            <li
              key={role}
              className="rounded-lg border border-[var(--border)] px-4 py-3"
            >
              <p className="font-medium text-[var(--foreground)]">
                {ACCOUNT_ROLE_LABELS[role]}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {ACCOUNT_ROLE_DESCRIPTIONS[role]}
              </p>
            </li>
          ))}
        </ul>
      </CardShell>

      <CardShell variant="default" padding="lg">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Maker-profiel</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Kies wat je doet op Hobbysalon: maker, workshopgever, leverancier, contentmaker of
          organisator. Dit bepaalt welke functies je in je dashboard ziet.
        </p>
        {creator ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--foreground)]">
              Huidige keuzes:{" "}
              {(creator.creator_types ?? [])
                .map((type) => creatorTypeLabels.get(type) ?? type)
                .join(", ") || "Maker"}
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/creator?tab=profiel">Maker-profiel bewerken</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Je hebt nog geen maker-profiel. Maak er een aan om workshops, producten of events te
              beheren.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/creator?tab=profiel">Maker-profiel aanmaken</Link>
            </Button>
          </div>
        )}
      </CardShell>

      <CardShell variant="default" padding="lg">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Winkel / verkoper</h2>
        {hasMerchantRole ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Je winkel is actief. Beheer je materiaalcatalogus en import via het dashboard of
              verkopersportaal.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard/materials">Mijn voorraad</Link>
              </Button>
              {hasSellerLink ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/verkoper">Verkopersportaal</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Verkoop je garen, stof of hobbybenodigdheden? Activeer je winkel op dit account. Je
              hoeft geen nieuw account aan te maken.
            </p>
            <MerchantUpgradeForm
              action={onboardMerchantForLoggedInUserAction}
              nextPath="/dashboard/account"
              defaultEmail={user.email ?? ""}
            />
          </div>
        )}
      </CardShell>

      <CardShell variant="default" padding="lg">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Voorkeuren</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Pas je interesses en locatie aan voor betere aanbevelingen.
        </p>
        <div className="mt-4">
          <RegistrationProfileForm
            action={updateAccountPreferencesAction}
            nextPath="/dashboard/account"
            defaultPostalCode={registrationContext.preference?.postalCode ?? null}
            defaultCountryCode={registrationContext.preference?.countryCode ?? null}
            defaultInterests={registrationContext.preference?.interestTypes ?? []}
          />
        </div>
      </CardShell>
    </section>
  );
}
