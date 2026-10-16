import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { registerAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import {
  getAccountRegistrationHref,
  getSafeInternalPath,
  resolveLegacyRegisterRedirect,
} from "@/lib/auth/account-paths";
import { Container } from "@/components/ui/container";
import { CardShell } from "@/components/ui/card-shell";

export const metadata: Metadata = {
  title: "Registreren",
  description:
    "Maak gratis je Hobbysalon-account. Bewaar favorieten en vind workshops en evenementen in je buurt.",
};

type Props = {
  searchParams: Promise<{
    next?: string;
    intent?: string;
    focus?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next, intent, focus } = await searchParams;
  const nextPath = getSafeInternalPath(next, "");

  if (user) {
    redirect(nextPath || "/");
  }

  // Old campaign links (?intent=offer, ?focus=maker) belong on the aanbieder path.
  const legacyRedirect = resolveLegacyRegisterRedirect({
    intent,
    focus,
    next: nextPath,
  });
  if (legacyRedirect) {
    redirect(legacyRedirect);
  }

  const loginHref = nextPath
    ? `/login?next=${encodeURIComponent(nextPath)}`
    : "/login";

  return (
    <div className="bg-[var(--section-alt)]">
      <Container className="max-w-xl py-10 sm:py-12">
        <header className="mb-6">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.02em] text-[var(--foreground)] sm:text-4xl">
            Maak je gratis account
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-[var(--muted)]">
            Bewaar favorieten, schrijf je in voor workshops en vind activiteiten
            in je buurt.
          </p>
        </header>

        <CardShell
          variant="default"
          padding="lg"
          className="border-[var(--border-strong)] shadow-[var(--shadow-md)]"
        >
          <RegisterForm
            action={registerAction}
            nextPath={nextPath}
            loginHref={loginHref}
          />
        </CardShell>

        <p className="mt-8 text-base leading-relaxed text-[var(--foreground)]">
          Wil je zelf workshops geven, creaties verkopen of een evenement
          organiseren?{" "}
          <Link
            href={getAccountRegistrationHref("aanbieder", nextPath)}
            className="font-semibold text-[var(--accent)] underline underline-offset-4"
          >
            Meld je aan als aanbieder
          </Link>
        </p>
      </Container>
    </div>
  );
}
