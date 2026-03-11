import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { registerAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
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
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Registreren</h1>
      <p className="mt-2 text-[var(--muted)]">
        Maak een account om favorieten op te slaan en je creator-dashboard te gebruiken.
      </p>

      <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <AuthForm mode="register" action={registerAction} nextPath={nextPath} />
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Al een account?{" "}
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="text-[var(--accent)] underline">
          Meld je aan
        </Link>
        .
      </p>
    </div>
  );
}
