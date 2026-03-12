import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { registerAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registreren | Hobbysalon",
  description:
    "Maak een account aan, kies je interesses en ontvang lokale hobby-aanbevelingen.",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : "";

  if (user) {
    redirect(nextPath || "/");
  }

  return (
    <PageLayout
      title="Registreren"
      description="Maak een account aan, geef je interesses en postcode op, en krijg relevantere workshops, events en materialen."
      size="narrow"
    >
      <CardShell variant="default" padding="lg">
        <AuthForm mode="register" action={registerAction} nextPath={nextPath} />
      </CardShell>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Al een account?{" "}
        <Link
          href={
            nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"
          }
          className="text-[var(--accent)] underline"
        >
          Meld je aan
        </Link>
        .
      </p>

      <p className="mt-2 text-sm text-[var(--muted)]">
        Ben je maker, workshopgever of organisator?{" "}
        <Link
          href={`/register/creator?next=${encodeURIComponent("/dashboard/creator")}`}
          className="text-[var(--accent)] underline"
        >
          Registreer als creator
        </Link>
        .
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Verkoop je hobbymaterialen?{" "}
        <Link
          href={`/register/merchant?next=${encodeURIComponent("/dashboard/materials")}`}
          className="text-[var(--accent)] underline"
        >
          Registreer als merchant
        </Link>
        .
      </p>
    </PageLayout>
  );
}
