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
  title: "Je winkel aanmelden",
  description:
    "Meld je winkel of materialen aan op Hobbysalon en bereik een gericht creatief publiek.",
};

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function RegisterMerchantPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next, error } = await searchParams;
  const nextPath = getSafeInternalPath(next, "/dashboard");

  if (user) {
    const context = await getUserRegistrationContext(user.id);
    if (context.roles.includes("merchant")) {
      // Confirmed merchants use the creator dashboard; Verkopersportaal is opt-in.
      redirect("/dashboard");
    }
  }

  return (
    <div className="bg-[var(--section-alt)]">
      <PageLayout
        title="Je winkel aanmelden"
        description="Voor winkels en handelaars met hobbymaterialen. Na je aanmelding stel je je winkel en productimport in."
        size="narrow"
      >
        <CardShell
          variant="default"
          padding="lg"
          className="border-[var(--border-strong)] shadow-[var(--shadow-md)]"
        >
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
          <p className="mt-4 text-base text-[var(--muted)]">
            Je bent aangemeld als <strong>{user.email ?? "account"}</strong>. Activeer
            hierboven je winkel op dit account.
          </p>
        ) : (
          <>
            <p className="mt-4 text-base text-[var(--muted)]">
              Al een account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                className="font-semibold text-[var(--accent)] underline underline-offset-4"
              >
                Meld je aan
              </Link>
              .
            </p>

            {/* Raw next only: the /dashboard fallback would skip /onboarding for other roles. */}
            <AccountChoiceCards
              nextPath={getSafeInternalPath(next, "")}
              current="merchant"
              title="Liever iets anders aanbieden?"
            />
          </>
        )}
      </PageLayout>
    </div>
  );
}
