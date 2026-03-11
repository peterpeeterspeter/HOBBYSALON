import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const creator = await getCreatorByUserId(user.id);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <Link href="/" className="font-semibold text-[var(--foreground)]">
              Hobbysalon
            </Link>
            <p className="text-xs text-[var(--muted)]">{user.email ?? "Ingelogd"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <nav className="flex flex-wrap items-center gap-4 text-sm">
              <Link href="/dashboard" className="hover:text-[var(--accent)]">
                Dashboard
              </Link>
              <Link href="/dashboard/creator" className="hover:text-[var(--accent)]">
                Creator
              </Link>
              <Link href="/dashboard/products" className="hover:text-[var(--accent)]">
                Producten
              </Link>
              <Link href="/dashboard/workshops" className="hover:text-[var(--accent)]">
                Workshops
              </Link>
              <Link href="/dashboard/events" className="hover:text-[var(--accent)]">
                Events
              </Link>
              <Link href="/dashboard/analytics" className="hover:text-[var(--accent)]">
                Analytics
              </Link>
            </nav>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)]"
              >
                Uitloggen
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!creator && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Maak eerst je creator-profiel aan om producten, workshops en events te beheren.
            <Link href="/dashboard/creator" className="ml-1 underline">
              Ga naar creator-profiel
            </Link>
            .
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
