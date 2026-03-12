import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { Container } from "@/components/ui/container";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";

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
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <Link href="/" className="inline-block">
                <Image
                  src="/logo.png"
                  alt="Hobbysalon"
                  width={140}
                  height={38}
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <p className="text-xs text-[var(--muted)] mt-1">{user.email ?? "Ingelogd"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <nav className="flex flex-wrap items-center gap-4 text-sm">
                <Link href="/dashboard" className="hover:text-[var(--accent)] transition-colors">
                  Dashboard
                </Link>
                <Link href="/dashboard/creator" className="hover:text-[var(--accent)] transition-colors">
                  Creator
                </Link>
                <Link href="/dashboard/products" className="hover:text-[var(--accent)] transition-colors">
                  Producten
                </Link>
                <Link href="/dashboard/materials" className="hover:text-[var(--accent)] transition-colors">
                  Materials Ops
                </Link>
                <Link href="/dashboard/workshops" className="hover:text-[var(--accent)] transition-colors">
                  Workshops
                </Link>
                <Link href="/dashboard/events" className="hover:text-[var(--accent)] transition-colors">
                  Events
                </Link>
                <Link href="/dashboard/analytics" className="hover:text-[var(--accent)] transition-colors">
                  Analytics
                </Link>
              </nav>
              <form action={logoutAction}>
                <Button type="submit" variant="secondary" size="sm">
                  Uitloggen
                </Button>
              </form>
            </div>
          </div>
        </Container>
      </header>
      <main>
        <Container className="py-8">
          {!creator && (
            <CardShell variant="featured" padding="md" className="mb-6 border-amber-300 bg-amber-50">
              <p className="text-sm text-amber-800">
                Maak eerst je creator-profiel aan om producten, workshops en events te beheren.{" "}
                <Link href="/dashboard/creator" className="underline font-medium">
                  Ga naar creator-profiel
                </Link>
              </p>
            </CardShell>
          )}
          {children}
        </Container>
      </main>
    </div>
  );
}
