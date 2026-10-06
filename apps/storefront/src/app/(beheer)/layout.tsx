import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { isModerator } from "@/lib/platform/queries/community-showcase";
import { BeheerNav } from "@/components/beheer/BeheerNav";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

/**
 * Moderator area. Kept apart from "Mijn aanbod" so platform tasks never mix
 * with a moderator's own offer.
 */
export default async function BeheerLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/beheer");
  }
  if (!(await isModerator(user.id))) {
    redirect("/dashboard");
  }

  return (
    <div className="dashboard-scope min-h-[100dvh] bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-4">
              <Link href="/" aria-label="Naar de website">
                <Image
                  src="/logo.png"
                  alt="Hobbysalon"
                  width={150}
                  height={100}
                  className="h-10 w-auto object-contain"
                />
              </Link>
              <p className="text-xl font-bold text-[var(--foreground)]">Beheer</p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Naar mijn aanbod</Link>
            </Button>
          </div>
          <div className="border-t border-[var(--border)] py-3">
            <BeheerNav />
          </div>
        </Container>
      </header>
      <main>
        <Container className="py-8 md:py-10">{children}</Container>
      </main>
    </div>
  );
}
