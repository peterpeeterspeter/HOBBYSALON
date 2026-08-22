import { redirect } from "next/navigation";
import { RegisterIntentForm } from "@/components/auth/RegisterIntentForm";
import { registerAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import { getSafeInternalPath } from "@/lib/auth/account-paths";
import {
  REGISTRATION_HOBBY_DOMAIN_SLUGS,
  REGISTRATION_OFFER_ROLES,
  type RegistrationOfferRole,
} from "@/lib/auth/registration-options";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import { Container } from "@/components/ui/container";
import { CardShell } from "@/components/ui/card-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registreren | Hobbysalon",
  description:
    "Maak je gratis Hobbysalon-account. Ontdek workshops, makers en materialen, of bied zelf iets aan. Geen abonnement.",
};

type Props = {
  searchParams: Promise<{
    next?: string;
    intent?: string;
    focus?: string;
  }>;
};

function parseInitialIntent(
  intent: string | undefined,
  focus: string | undefined
): "discover" | "offer" | null {
  const value = intent?.trim().toLowerCase();
  if (value === "offer" || value === "aanbieden") return "offer";
  if (value === "discover" || value === "ontdekken") return "discover";
  if (focus) return "offer";
  return null;
}

function parseInitialOfferRole(
  focus: string | undefined
): RegistrationOfferRole | null {
  const value = focus?.trim().toLowerCase();
  if (!value) return null;
  if (value === "workshopgever") return "workshopgever";
  if (value === "maker" || value === "creator") return "maker";
  if (value === "organizer" || value === "organisator") return "organizer";
  if (value === "merchant" || value === "verkoper") return "merchant";
  if ((REGISTRATION_OFFER_ROLES as readonly string[]).includes(value)) {
    return value as RegistrationOfferRole;
  }
  return null;
}

export default async function RegisterPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next, intent, focus } = await searchParams;
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

  const loginHref = nextPath
    ? `/login?next=${encodeURIComponent(nextPath)}`
    : "/login";

  return (
    <div className="bg-[var(--section-alt)]">
      <Container className="max-w-2xl py-10 sm:py-12">
        <header className="mb-8">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
            Maak je gratis Hobbysalon-account
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Ontdek creatieve workshops, makers, evenementen, inspiratie en
            materialen. Of deel zelf wat jij maakt, organiseert of aanbiedt.
          </p>
          <p className="mt-3 text-sm font-semibold text-[var(--foreground)] sm:text-base">
            Gratis account. Geen abonnement. Je zit nergens aan vast.
          </p>
        </header>

        <CardShell
          variant="default"
          padding="lg"
          className="border-[var(--border-strong)] shadow-[var(--shadow-md)]"
        >
          <RegisterIntentForm
            action={registerAction}
            nextPath={nextPath}
            hobbyDomains={hobbyDomains}
            loginHref={loginHref}
            initialIntent={parseInitialIntent(intent, focus)}
            initialOfferRole={parseInitialOfferRole(focus)}
          />
        </CardShell>
      </Container>
    </div>
  );
}
