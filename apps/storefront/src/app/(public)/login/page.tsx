import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AccountChoiceCards } from "@/components/auth/AccountChoiceCards";
import { loginAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import { getSafeInternalPath } from "@/lib/auth/account-paths";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aanmelden | Hobbysalon",
  description: "Meld je aan om favorieten en je dashboard te beheren.",
};

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next, error } = await searchParams;
  const nextPath = getSafeInternalPath(next, "");

  if (user) {
    redirect(nextPath || "/");
  }

  return (
    <PageLayout
      title="Aanmelden"
      description="Meld je aan om je favorieten en creator-dashboard te beheren."
      size="narrow"
    >
      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      )}

      <CardShell variant="default" padding="lg">
        <AuthForm mode="login" action={loginAction} nextPath={nextPath} />
        <p className="mt-4 text-sm text-[var(--muted)]">
          <Link
            href={
              nextPath
                ? `/wachtwoord-vergeten?next=${encodeURIComponent(nextPath)}`
                : "/wachtwoord-vergeten"
            }
            className="font-semibold text-[var(--accent)] underline underline-offset-4 hover:no-underline"
          >
            Wachtwoord vergeten?
          </Link>
        </p>
      </CardShell>

      <AccountChoiceCards nextPath={nextPath} />
    </PageLayout>
  );
}
