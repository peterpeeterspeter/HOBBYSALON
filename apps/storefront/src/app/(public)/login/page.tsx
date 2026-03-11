import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { loginAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
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
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Aanmelden</h1>
      <p className="mt-2 text-[var(--muted)]">
        Meld je aan om je favorieten en creator-dashboard te beheren.
      </p>

      <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <AuthForm mode="login" action={loginAction} nextPath={nextPath} />
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Nog geen account?{" "}
        <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="text-[var(--accent)] underline">
          Registreer hier
        </Link>
        .
      </p>
    </div>
  );
}
