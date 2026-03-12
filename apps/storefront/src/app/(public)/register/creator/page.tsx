import Link from "next/link";
import { redirect } from "next/navigation";
import { registerCreatorAction } from "@/app/actions/auth";
import { CreatorRegisterForm } from "@/components/auth/CreatorRegisterForm";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { getAuthUser } from "@/lib/auth/session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Registreren | Hobbysalon",
  description:
    "Start als maker, workshopgever of organisator met een creator-account op Hobbysalon.",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterCreatorPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : "/dashboard/creator";

  if (user) {
    redirect(nextPath);
  }

  return (
    <PageLayout
      title="Creator registreren"
      description="Registreer je als maker, workshopgever of organisator en beheer je profiel en aanbod vanuit je dashboard."
      size="narrow"
    >
      <CardShell variant="default" padding="lg">
        <CreatorRegisterForm action={registerCreatorAction} nextPath={nextPath} />
      </CardShell>

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

      <p className="mt-2 text-sm text-[var(--muted)]">
        Gewone gebruiker?{" "}
        <Link
          href={`/register?next=${encodeURIComponent(nextPath)}`}
          className="text-[var(--accent)] underline"
        >
          Gebruik standaard registratie
        </Link>
        .
      </p>
    </PageLayout>
  );
}
