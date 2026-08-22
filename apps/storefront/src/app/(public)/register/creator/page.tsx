import Link from "next/link";
import { redirect } from "next/navigation";
import { registerCreatorAction } from "@/app/actions/auth";
import { CreatorRegisterForm } from "@/components/auth/CreatorRegisterForm";
import { AccountChoiceCards } from "@/components/auth/AccountChoiceCards";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { getAuthUser } from "@/lib/auth/session";
import {
  getSafeInternalPath,
  type AccountRegistrationType,
} from "@/lib/auth/account-paths";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Registreren | Hobbysalon",
  description:
    "Start als workshopgever, maker of makersmarkt organisator met een creator-account op Hobbysalon.",
};

type Props = {
  searchParams: Promise<{ next?: string; focus?: string }>;
};

function resolveFocus(
  focus: string | undefined
): {
  current: AccountRegistrationType;
  title: string;
  description: string;
  defaultCreatorTypes: string[];
} {
  if (focus === "workshopgever") {
    return {
      current: "workshopgever",
      title: "Workshopgever worden",
      description:
        "Registreer je om workshops aan te bieden, aanvragen te ontvangen en je vak te delen.",
      defaultCreatorTypes: ["workshopgever", "maker"],
    };
  }

  if (focus === "organizer") {
    return {
      current: "organizer",
      title: "Organisator worden",
      description:
        "Registreer je om je markt, beurs of open atelier in de Hobbysalon-agenda te zetten.",
      defaultCreatorTypes: ["organizer"],
    };
  }

  if (focus === "maker") {
    return {
      current: "maker",
      title: "Maker worden",
      description:
        "Registreer je om je creaties te tonen en hobbyisten te laten ontdekken wat je maakt.",
      defaultCreatorTypes: ["maker"],
    };
  }

  return {
    current: "creator",
    title: "Creator registreren",
    description:
      "Registreer je als maker, workshopgever of organisator en beheer je profiel en aanbod vanuit je dashboard.",
    defaultCreatorTypes: ["maker"],
  };
}

export default async function RegisterCreatorPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next, focus } = await searchParams;
  // Hash-free: this path is also used in login?next= and auth confirm redirects.
  const nextPath = getSafeInternalPath(next, "/profile?tab=profiel");
  const resolved = resolveFocus(focus);

  if (user) {
    const context = await getUserRegistrationContext(user.id);
    if (context.hasCreatorProfile) {
      redirect(nextPath.startsWith("/profile") ? "/onboarding" : nextPath);
    }
    // Logged-in base account: finish via role onboarding (DB intent), not generic profile.
    if (focus === "workshopgever" || focus === "maker" || focus === "organizer") {
      const { updateUserOfferIntent } = await import(
        "@/lib/platform/queries/user-registration"
      );
      await updateUserOfferIntent({
        userId: user.id,
        offerRoles: [focus],
        primaryOfferRole: focus,
      });
    }
    redirect("/onboarding");
  }

  return (
    <div className="bg-[var(--section-alt)]">
      <PageLayout
        title={resolved.title}
        description={resolved.description}
        size="narrow"
      >
        <CardShell
          variant="default"
          padding="lg"
          className="border-[var(--border-strong)] shadow-[var(--shadow-md)]"
        >
          <CreatorRegisterForm
            action={registerCreatorAction}
            nextPath={nextPath}
            defaultCreatorTypes={resolved.defaultCreatorTypes}
          />
        </CardShell>

        <p className="mt-4 text-sm text-[var(--muted)]">
          Al een account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-[var(--accent)] underline"
          >
            Meld je aan
          </Link>
          .
        </p>

        <AccountChoiceCards nextPath={nextPath} current={resolved.current} />
      </PageLayout>
    </div>
  );
}
