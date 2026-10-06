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
import {
  countNewEventVendorInquiries,
  countNewProductInquiries,
  countNewWorkshopBookingRequests,
} from "@/lib/platform/queries/product-inquiries";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { AccountSideSwitch } from "@/components/dashboard/AccountSideSwitch";
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

  const [newProductInquiryCount, newWorkshopBookingCount, newEventVendorInquiryCount] =
    creator
      ? await Promise.all([
          caps.canManageProducts ? countNewProductInquiries(creator.id) : Promise.resolve(0),
          caps.canManageWorkshops
            ? countNewWorkshopBookingRequests(creator.id)
            : Promise.resolve(0),
          caps.canManageEvents
            ? countNewEventVendorInquiries(creator.id)
            : Promise.resolve(0),
        ])
      : [0, 0, 0];

  const navItems = buildRoleAwareDashboardNav(caps, {
    userIsModerator,
    newProductInquiryCount,
    newWorkshopBookingCount,
    newEventVendorInquiryCount,
  });

  return (
    <div className="dashboard-scope min-h-[100dvh] bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-5">
              <Link href="/" className="inline-block shrink-0" aria-label="Naar de website">
                <Image
                  src="/logo.png"
                  alt="Hobbysalon"
                  width={150}
                  height={100}
                  className="h-10 w-auto object-contain"
                />
              </Link>
              <AccountSideSwitch active="aanbod" />
            </div>
            <div className="flex items-center gap-3">
              <p className="hidden max-w-[16rem] truncate text-base text-[var(--muted)] md:block">
                {user.email ?? "Ingelogd"}
              </p>
              <form action={logoutAction}>
                <Button type="submit" variant="secondary">
                  Uitloggen
                </Button>
              </form>
            </div>
          </div>
          <div className="border-t border-[var(--border)] py-3">
            <DashboardNav items={navItems} />
          </div>
        </Container>
      </header>
      <main>
        <Container className="py-8 md:py-10">{children}</Container>
      </main>
    </div>
  );
}
