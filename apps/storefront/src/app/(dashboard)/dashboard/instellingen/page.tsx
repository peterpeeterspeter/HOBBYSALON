import Link from "next/link";
import { updateCreatorTypesAction } from "@/app/actions/dashboard";
import { createCreditPackCheckoutAction } from "@/app/actions/listing-checkout";
import { RoleUpgradeSection } from "@/components/auth/RoleUpgradeSection";
import { Button } from "@/components/ui/button";
import { DashboardNotice, DashboardPageHeader, FlashMessage } from "@/components/dashboard/ui";
import { CREATOR_TYPES } from "@/components/dashboard/creator/types";
import { getDashboardContext } from "@/lib/dashboard/load";
import { hasPendingRoleRequest, privilegedRoleLabel } from "@/lib/auth/role-request-status";
import { isCommercialGatingEnabled } from "@/lib/platform/commercial-entitlements";
import { getCreditBalance } from "@/lib/platform/listing-credits";
import { getWorkshopLaunchDashboardStats } from "@/lib/platform/workshop-listing-fee";
import { WORKSHOP_FREE_LISTING_CAP, WORKSHOP_LAUNCH_COPY } from "@/lib/pricing/workshop-launch-offer";
import { createPlatformClient } from "@/lib/platform/client";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

type CreditPack = {
  pack_code: string;
  name: string;
  credits: number;
  price_cents: number;
};

const euro = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

/** "Instellingen": what you offer (roles), credits, and account links. */
export default async function SettingsPage({ searchParams }: Props) {
  const { success, error } = await searchParams;
  const { user, creator, registrationContext, caps } =
    await getDashboardContext("/dashboard/instellingen");

  const pending = registrationContext.pendingRoleRequests;
  const pendingNames = pending
    .filter((request) => request.status === "pending")
    .map((request) => privilegedRoleLabel(request.role));
  const selectedTypes = new Set(creator?.creator_types ?? []);
  const gating = isCommercialGatingEnabled();

  const [balance, packsResult, launchStats] = await Promise.all([
    creator && gating ? getCreditBalance(creator.id) : Promise.resolve(null),
    creator && gating
      ? createPlatformClient()
          .from("listing_credit_products")
          .select("pack_code, name, credits, price_cents")
          .eq("is_active", true)
          .order("credits", { ascending: true })
      : Promise.resolve({ data: [] }),
    creator && caps.canDraftWorkshops
      ? getWorkshopLaunchDashboardStats(creator.id)
      : Promise.resolve(null),
  ]);
  const packs = (packsResult.data ?? []) as CreditPack[];

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <DashboardPageHeader title="Instellingen" lead={`Ingelogd als ${user.email ?? "account"}.`} />
        <FlashMessage success={success} error={error} />
      </div>

      <section id="aanbieden" className="scroll-mt-24" aria-labelledby="aanbieden-titel">
        <h2 id="aanbieden-titel" className="text-2xl font-bold text-[var(--foreground)]">
          Wat wil je aanbieden?
        </h2>
        <p className="mt-2 text-lg text-[var(--muted)]">
          Wat je hier kiest, bepaalt wat je in je dashboard ziet. Workshops en events vragen een
          korte goedkeuring.
        </p>

        {pendingNames.length > 0 ? (
          <div className="mt-4">
            <DashboardNotice title="Wacht op goedkeuring" tone="attention">
              {pendingNames.join(" en ")}. Je krijgt een e-mail zodra we je aanvraag bekeken.
            </DashboardNotice>
          </div>
        ) : null}

        {creator ? (
          <form
            action={updateCreatorTypesAction}
            className="mt-5 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-7"
          >
            {CREATOR_TYPES.map((type) => (
              <label
                key={type.value}
                className="flex min-h-12 cursor-pointer items-start gap-4 rounded-xl border border-[var(--border)] p-4 hover:border-[var(--foreground)]"
              >
                <input
                  type="checkbox"
                  name="creator_types"
                  value={type.value}
                  defaultChecked={
                    selectedTypes.size > 0 ? selectedTypes.has(type.value) : type.value === "maker"
                  }
                  className="mt-1"
                />
                <span>
                  <span className="block text-xl font-semibold text-[var(--foreground)]">
                    {type.label}
                    {type.value === "workshopgever" &&
                    hasPendingRoleRequest(pending, "workshop_host")
                      ? " (wacht op goedkeuring)"
                      : type.value === "organizer" && hasPendingRoleRequest(pending, "organizer")
                        ? " (wacht op goedkeuring)"
                        : ""}
                  </span>
                  <span className="block text-lg text-[var(--muted)]">{type.description}</span>
                </span>
              </label>
            ))}
            <Button type="submit" size="lg">
              Opslaan
            </Button>
          </form>
        ) : null}

        <RoleUpgradeSection
          roles={registrationContext.roles}
          creatorTypes={creator?.creator_types ?? null}
          hasCreatorProfile={Boolean(creator)}
          pendingRoleRequests={pending}
          title={creator ? "Ook een winkel openen?" : "Aanbieder worden"}
          lead={
            creator
              ? "Verkoop je materialen via een eigen winkel met betaling en verzending."
              : "Kies wat je wil aanbieden. Je kan later altijd uitbreiden."
          }
          className="mt-6 space-y-3"
          showEmptyState={!creator}
        />
      </section>

      {launchStats?.launchWindowOpen ? (
        <section aria-labelledby="lancering-titel">
          <h2 id="lancering-titel" className="text-2xl font-bold text-[var(--foreground)]">
            {WORKSHOP_LAUNCH_COPY.offerHeadline}
          </h2>
          <p className="mt-2 text-lg text-[var(--muted)]">{WORKSHOP_LAUNCH_COPY.offerBody}</p>
          <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            {WORKSHOP_LAUNCH_COPY.freeSlotsLabel(launchStats.launchFreeUsed, WORKSHOP_FREE_LISTING_CAP)}
          </p>
        </section>
      ) : null}

      {balance !== null ? (
        <section id="credits" className="scroll-mt-24" aria-labelledby="credits-titel">
          <h2 id="credits-titel" className="text-2xl font-bold text-[var(--foreground)]">
            Credits
          </h2>
          <p className="mt-2 text-lg text-[var(--muted)]">
            Je saldo: <strong className="text-[var(--foreground)]">{balance} credits</strong>.
            Zichtbaar maken kost credits.
          </p>
          {packs.length > 0 ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {packs.map((pack) => (
                <li key={pack.pack_code}>
                  <form
                    action={createCreditPackCheckoutAction}
                    className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
                  >
                    <input type="hidden" name="pack_code" value={pack.pack_code} />
                    <span className="text-xl font-bold text-[var(--foreground)]">{pack.name}</span>
                    <span className="text-lg text-[var(--muted)]">
                      {pack.credits} credits voor {euro.format(pack.price_cents / 100)}
                    </span>
                    <Button type="submit" variant="secondary" size="lg" className="mt-auto">
                      Kopen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="account-titel">
        <h2 id="account-titel" className="text-2xl font-bold text-[var(--foreground)]">
          Je account
        </h2>
        <p className="mt-2 text-lg text-[var(--muted)]">
          Je naam, e-mail, interesses en nieuwsbrief beheer je in Mijn Hobbysalon.
        </p>
        <Button asChild variant="secondary" size="lg" className="mt-4">
          <Link href="/profile">Naar Mijn Hobbysalon</Link>
        </Button>
      </section>
    </div>
  );
}
