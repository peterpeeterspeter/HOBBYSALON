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
  description: "Maak een account aan om favorieten en je dashboard te beheren.",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : "/dashboard";

  if (user) {
    redirect(nextPath);
  }

  return (
    <PageLayout
      title="Registreren"
      description="Maak een account om favorieten op te slaan en je creator-dashboard te gebruiken."
      size="narrow"
    >
      <CardShell variant="default" padding="lg">
        <AuthForm mode="register" action={registerAction} nextPath={nextPath} />
      </CardShell>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Al een account?{" "}
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="text-[var(--accent)] underline">
          Meld je aan
        </Link>
        .
      </p>
    </PageLayout>
  );
}
