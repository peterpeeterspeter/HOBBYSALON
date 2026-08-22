import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import {
  getOnboardingProfileCopy,
  type RegistrationOfferRole,
} from "@/lib/auth/registration-options";
import {
  getPublishPath,
  resolveOnboardingRole,
} from "@/lib/onboarding/offer-onboarding";
import { completeOfferOnboardingAction } from "@/app/actions/onboarding";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Profiel klaar | Hobbysalon",
};

type Props = {
  searchParams: Promise<{ role?: string }>;
};

export default async function OnboardingSuccessPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/onboarding/success");
  }

  const { role: bootstrapRole } = await searchParams;
  const [context, creator] = await Promise.all([
    getUserRegistrationContext(user.id),
    getCreatorByUserId(user.id),
  ]);

  const role = resolveOnboardingRole(context, bootstrapRole);
  if (!role || role === "merchant" || !creator) {
    redirect("/onboarding");
  }

  const offerRole = role as Exclude<RegistrationOfferRole, "merchant">;
  const copy = getOnboardingProfileCopy(offerRole);
  const listingLabel =
    offerRole === "workshopgever"
      ? "Workshop"
      : offerRole === "organizer"
        ? "Evenement"
        : "Creatie";
  const viewHref = getPublishPath(offerRole);
  const pending =
    offerRole === "workshopgever"
      ? context.pendingRoleRequests.some(
          (request) =>
            request.role === "workshop_host" && request.status === "pending"
        )
      : offerRole === "organizer"
        ? context.pendingRoleRequests.some(
            (request) =>
              request.role === "organizer" && request.status === "pending"
          )
        : false;
  const approved =
    offerRole === "workshopgever"
      ? context.roles.includes("workshop_host")
      : offerRole === "organizer"
        ? context.roles.includes("organizer")
        : true;

  return (
    <PageLayout
      title="Je profiel staat klaar"
      description={`${copy.title} is opgeslagen.`}
      size="narrow"
    >
      <CardShell variant="featured" padding="lg" className="space-y-4">
        <p className="text-lg font-semibold text-[var(--foreground)]">
          {listingLabel} opgeslagen als concept
        </p>
        {pending ? (
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Je aanbiedersrol wordt beoordeeld. Zodra die goedgekeurd is, kun je
            publiceren. We sturen je een e-mail met een link.
          </p>
        ) : approved ? (
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Je mag nu publiceren zodat bezoekers je kunnen vinden.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Bekijk je concept en vul het verder aan wanneer je wilt.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href={viewHref}>Bekijk concept</Link>
          </Button>
          {approved ? (
            <Button asChild variant="secondary">
              <Link href={viewHref}>Publiceren</Link>
            </Button>
          ) : null}
          <form action={completeOfferOnboardingAction}>
            <Button type="submit" variant="secondary">
              Naar dashboard
            </Button>
          </form>
        </div>
      </CardShell>
    </PageLayout>
  );
}
