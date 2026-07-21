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
      title: "Makersmarkt organisator worden",
      description:
        "Registreer je om je markt, beurs of open atelier in de Hobbysalon-agenda te zetten.",
      defaultCreatorTypes: ["organizer"],
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
  const nextPath = getSafeInternalPath(next, "/profile?tab=profiel#maker-pagina");
  const resolved = resolveFocus(focus);

  if (user) {
    redirect(nextPath);
  }

  return (
    <PageLayout
      title={resolved.title}
      description={resolved.description}
      size="narrow"
    >
      <CardShell variant="default" padding="lg">
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
  );
}
