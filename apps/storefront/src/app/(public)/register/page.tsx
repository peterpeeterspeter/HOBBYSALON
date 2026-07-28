import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AccountChoiceCards } from "@/components/auth/AccountChoiceCards";
import { registerAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import { getSafeInternalPath } from "@/lib/auth/account-paths";
import { REGISTRATION_HOBBY_DOMAIN_SLUGS } from "@/lib/auth/registration-options";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registreren | Hobbysalon",
  description:
    "Maak een gratis hobbyistenaccount aan, kies je interesses en ontvang relevantere workshops, materialen en inspiratie.",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next } = await searchParams;
  const nextPath = getSafeInternalPath(next, "");

  if (user) {
    redirect(nextPath || "/");
  }

  const preferredSlugSet = new Set<string>(REGISTRATION_HOBBY_DOMAIN_SLUGS);
  let hobbyDomains: Array<{ id: string; slug: string; name: string }> = [];
  try {
    const domains = await listActiveDomains();
    hobbyDomains = domains
      .filter((domain) => preferredSlugSet.has(domain.slug))
      .map((domain) => ({
        id: domain.id,
        slug: domain.slug,
        name: domain.name,
      }));
  } catch {
    hobbyDomains = [];
  }

  return (
    <div className="bg-[var(--section-alt)]">
      <PageLayout
        title="Word hobbyist op Hobbysalon"
        description="Maak een gratis account aan voor inspiratie, workshops en materialen. Aanbiedersrollen kies je apart hieronder."
        size="narrow"
      >
        <CardShell
          variant="default"
          padding="lg"
          className="border-[var(--border-strong)] shadow-[var(--shadow-md)]"
        >
          <AuthForm
            mode="register"
            action={registerAction}
            nextPath={nextPath}
            hobbyDomains={hobbyDomains}
          />
        </CardShell>

        <p className="mt-4 text-sm text-[var(--muted)]">
          Al een account?{" "}
          <Link
            href={
              nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"
            }
            className="font-medium text-[var(--accent)] underline"
          >
            Meld je aan
          </Link>
          .
        </p>

        <AccountChoiceCards nextPath={nextPath} current="member" />
      </PageLayout>
    </div>
  );
}
