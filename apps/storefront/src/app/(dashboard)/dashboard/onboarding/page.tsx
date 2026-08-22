import { redirect } from "next/navigation";
import Link from "next/link";
import { completeRegistrationProfileAction } from "@/app/actions/auth";
import { RegistrationProfileForm } from "@/components/auth/RegistrationProfileForm";
import { CardShell } from "@/components/ui/card-shell";
import { getAuthUser } from "@/lib/auth/session";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function DashboardOnboardingPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/onboarding");
  }

  const context = await getUserRegistrationContext(user.id);
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : "";

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Voorkeuren</h1>
        <p className="mt-2 text-[var(--muted)]">
          Werk je interesses en locatie bij. Voor rollen en winkel-activatie ga naar{" "}
          <Link href="/dashboard#account" className="text-[var(--accent)] underline">
            Account & rollen
          </Link>
          .
        </p>
      </header>

      <CardShell variant="default" padding="lg">
        <RegistrationProfileForm
          action={completeRegistrationProfileAction}
          nextPath={nextPath}
          defaultPostalCode={context.preference?.postalCode ?? null}
          defaultCountryCode={context.preference?.countryCode ?? null}
          defaultInterests={context.preference?.interestTypes ?? []}
        />
      </CardShell>
    </section>
  );
}
