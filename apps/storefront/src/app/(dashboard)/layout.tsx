import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import {
  buildRoleAwareDashboardNav,
  resolveDashboardCapabilities,
} from "@/lib/auth/dashboard-access";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { isModerator } from "@/lib/platform/queries/community-showcase";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { Container } from "@/components/ui/container";
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

  const [creator, registrationContext, userIsModerator] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
    isModerator(user.id),
  ]);

  const caps = resolveDashboardCapabilities({
    registrationContext,
    creatorTypes: creator?.creator_types,
    hasCreatorProfile: Boolean(creator),
  });

  const navItems = buildRoleAwareDashboardNav(caps, { userIsModerator });

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <Link href="/" className="inline-block">
                <Image
                  src="/logo.png"
                  alt="Hobbysalon"
                  width={150}
                  height={100}
                  className="h-9 w-auto object-contain"
                />
              </Link>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                {user.email ?? "Ingelogd"}
              </p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Uitloggen
              </Button>
            </form>
          </div>
          <div className="border-t border-[var(--border)] py-3">
            <DashboardNav items={navItems} />
          </div>
        </Container>
      </header>
      <main>
        <Container className="py-8">{children}</Container>
      </main>
    </div>
  );
}
