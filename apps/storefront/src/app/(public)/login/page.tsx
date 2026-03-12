import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { loginAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aanmelden | Hobbysalon",
  description: "Meld je aan om favorieten en je dashboard te beheren.",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : "/dashboard";

  if (user) {
    redirect(nextPath);
  }

  return (
    <PageLayout
      title="Aanmelden"
      description="Meld je aan om je favorieten en creator-dashboard te beheren."
      size="narrow"
    >
      <CardShell variant="default" padding="lg">
        <AuthForm mode="login" action={loginAction} nextPath={nextPath} />
      </CardShell>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Nog geen account?{" "}
        <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="text-[var(--accent)] underline">
          Registreer hier
        </Link>
        .
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Creator-account nodig?{" "}
        <Link
          href={`/register/creator?next=${encodeURIComponent("/dashboard/creator")}`}
          className="text-[var(--accent)] underline"
        >
          Registreer als creator
        </Link>
        .
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Merchant-account nodig?{" "}
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
