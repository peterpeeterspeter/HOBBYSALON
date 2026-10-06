import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { registerAction } from "@/app/actions/auth";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { getAuthUser } from "@/lib/auth/session";
import {
  getAccountRegistrationHref,
  getSafeInternalPath,
  parseOfferRoleParam,
} from "@/lib/auth/account-paths";
import {
  getUserRegistrationContext,
  updateUserOfferIntent,
} from "@/lib/platform/queries/user-registration";

export const metadata: Metadata = {
  title: "Aanmelden als aanbieder",
  description:
    "Maak je gratis account en stel daarna je profiel in als workshopgever, maker of organisator.",
};

type Props = {
  searchParams: Promise<{ next?: string; focus?: string }>;
};

const ROLE_COPY = {
  workshopgever: {
    title: "Workshops geven",
    lead: "Maak eerst je gratis account. Daarna stel je je profiel in en zet je je eerste workshop klaar.",
    needsReview: true,
  },
  maker: {
    title: "Je creaties, tutorials of patronen delen",
    lead: "Maak eerst je gratis account. Daarna stel je je profiel in en voeg je je eerste creatie of tutorial toe.",
    needsReview: false,
  },
  organizer: {
    title: "Een markt of evenement organiseren",
    lead: "Maak eerst je gratis account. Daarna stel je je profiel in en zet je je evenement in de agenda.",
    needsReview: true,
  },
} as const;

export default async function RegisterCreatorPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next, focus } = await searchParams;
  const nextPath = getSafeInternalPath(next, "");
  const role = parseOfferRoleParam(focus);

  if (!role) {
    redirect(getAccountRegistrationHref("aanbieder", nextPath));
  }
  if (role === "merchant") {
    redirect(getAccountRegistrationHref("merchant", nextPath));
  }

  if (user) {
    const context = await getUserRegistrationContext(user.id);
    if (context.hasCreatorProfile) {
      redirect(
        nextPath && !nextPath.startsWith("/profile") ? nextPath : "/onboarding"
      );
    }
    // Logged-in base account: finish via role onboarding (DB intent).
    await updateUserOfferIntent({
      userId: user.id,
      offerRoles: [role],
      primaryOfferRole: role,
    });
    redirect("/onboarding");
  }

  const copy = ROLE_COPY[role];
  const loginHref = `/login?next=${encodeURIComponent(
    nextPath || `/register/creator?focus=${role}`
  )}`;

  return (
    <div className="bg-[var(--section-alt)]">
      <PageLayout title={copy.title} description={copy.lead} size="narrow">
        <CardShell
          variant="default"
          padding="lg"
          className="border-[var(--border-strong)] shadow-[var(--shadow-md)]"
        >
          {/* No next path: offer signups must pass /onboarding to get a profile. */}
          <RegisterForm
            action={registerAction}
            nextPath=""
            loginHref={loginHref}
            offerRole={role}
            submitLabel="Account maken en verder"
          />
        </CardShell>

        {copy.needsReview ? (
          <p className="mt-6 text-base leading-relaxed text-[var(--muted)]">
            Nieuwe workshopgevers en organisatoren worden eerst kort nagekeken
            door Hobbysalon. Je kunt intussen al je profiel en aanbod
            klaarzetten.
          </p>
        ) : null}
      </PageLayout>
    </div>
  );
}
