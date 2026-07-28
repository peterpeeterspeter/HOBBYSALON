import Link from "next/link";
import { redirect } from "next/navigation";
import {
  onboardMerchantForLoggedInUserAction,
  registerMerchantAction,
} from "@/app/actions/auth";
import { MerchantRegisterForm } from "@/components/auth/MerchantRegisterForm";
import { MerchantUpgradeForm } from "@/components/auth/MerchantUpgradeForm";
import { AccountChoiceCards } from "@/components/auth/AccountChoiceCards";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { getAuthUser } from "@/lib/auth/session";
import { getSafeInternalPath } from "@/lib/auth/account-paths";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merchant Registreren | Hobbysalon",
  description:
    "Registreer als hobbymaterialenverkoper en start met je merchant onboarding op Hobbysalon.",
};

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function RegisterMerchantPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next, error } = await searchParams;
  const nextPath = getSafeInternalPath(next, "/dashboard/verkoper");

  if (user) {
    const context = await getUserRegistrationContext(user.id);
    if (context.roles.includes("merchant")) {
      // Confirmed merchants go to handoff (self-heals missing seller link).
      redirect("/dashboard/verkoper");
    }
  }

  return (
    <PageLayout
      title="Merchant registreren"
      description="Voor winkels en handelaars met materiaalcatalogi. Na registratie kan je direct je import en mapping setup starten."
      size="narrow"
    >
      <CardShell variant="default" padding="lg">
        {error && (
          <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {user ? (
          <MerchantUpgradeForm
            action={onboardMerchantForLoggedInUserAction}
            nextPath={nextPath}
            defaultEmail={user.email ?? ""}
          />
        ) : (
          <MerchantRegisterForm action={registerMerchantAction} nextPath={nextPath} />
        )}
      </CardShell>

      {user ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Je bent aangemeld als <strong>{user.email ?? "account"}</strong>. Activeer hierboven je
          merchant-profiel op deze account.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Al een account?{" "}
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="text-[var(--accent)] underline"
            >
              Meld je aan
            </Link>
            .
          </p>

          <AccountChoiceCards nextPath={nextPath} current="merchant" />
        </>
      )}
    </PageLayout>
  );
}
