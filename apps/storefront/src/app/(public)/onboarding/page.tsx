import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import {
  getUserRegistrationContext,
  updateUserOfferIntent,
} from "@/lib/platform/queries/user-registration";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { createPlatformClient } from "@/lib/platform/client";
import {
  getOnboardingProfileCopy,
  type RegistrationOfferRole,
} from "@/lib/auth/registration-options";
import {
  getFirstListingPath,
  getRoleStatusLabel,
  resolveOnboardingRole,
} from "@/lib/onboarding/offer-onboarding";
import {
  saveOnboardingProfileAction,
  skipOfferOnboardingAction,
} from "@/app/actions/onboarding";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Aanbod instellen | Hobbysalon",
  description: "Rond je aanbiedersprofiel af en voeg je eerste aanbod toe.",
};

type Props = {
  searchParams: Promise<{ role?: string; success?: string; error?: string }>;
};

function isProfileReady(creator: {
  display_name?: string | null;
  business_name?: string | null;
  city?: string | null;
  bio?: string | null;
  email?: string | null;
} | null): boolean {
  if (!creator) return false;
  const hasName = Boolean(
    creator.business_name?.trim() || creator.display_name?.trim()
  );
  return (
    hasName &&
    Boolean(creator.city?.trim()) &&
    Boolean(creator.bio?.trim()) &&
    Boolean(creator.email?.trim())
  );
}

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const { role: bootstrapRole, success, error } = await searchParams;
  const [context, creator, domains] = await Promise.all([
    getUserRegistrationContext(user.id),
    getCreatorByUserId(user.id),
    listDomainsBySort(),
  ]);

  const role = resolveOnboardingRole(context, bootstrapRole);
  if (
    !context.preference?.primaryOfferRole &&
    role &&
    role !== "merchant"
  ) {
    await updateUserOfferIntent({
      userId: user.id,
      offerRoles: Array.from(
        new Set([...(context.preference?.offerRoles ?? []), role])
      ),
      primaryOfferRole: role,
    });
  }

  if (role === "merchant") {
    redirect("/register/merchant");
  }

  if (!role) {
    redirect("/profile");
  }

  const offerRole = role as Exclude<RegistrationOfferRole, "merchant">;
  const copy = getOnboardingProfileCopy(offerRole);
  const profileReady = isProfileReady(creator);

  const supabase = createPlatformClient();
  let domainCount = 0;
  let draftCount = 0;
  let publishedCount = 0;

  if (creator) {
    const [domainsResult, listingResult] = await Promise.all([
      supabase
        .from("creator_domains")
        .select("domain_id", { head: true, count: "exact" })
        .eq("creator_id", creator.id),
      offerRole === "workshopgever"
        ? supabase
            .from("workshops")
            .select("id,is_active")
            .eq("creator_id", creator.id)
        : offerRole === "organizer"
          ? supabase
              .from("events")
              .select("id,is_active")
              .eq("creator_id", creator.id)
          : supabase
              .from("products")
              .select("id,is_active,status")
              .eq("creator_id", creator.id),
    ]);
    domainCount = domainsResult.count ?? 0;
    const rows = listingResult.data ?? [];
    draftCount = rows.length;
    publishedCount = rows.filter((row) => {
      if ("is_active" in row && row.is_active) return true;
      if ("status" in row && row.status === "active") return true;
      return false;
    }).length;
  }

  if (profileReady && domainCount > 0 && draftCount === 0) {
    redirect(getFirstListingPath(offerRole));
  }

  if (profileReady && domainCount > 0 && draftCount > 0) {
    redirect(`/onboarding/success?role=${offerRole}`);
  }

  const privilegedRole =
    offerRole === "workshopgever"
      ? "workshop_host"
      : offerRole === "organizer"
        ? "organizer"
        : null;
  const hasApprovedRole = privilegedRole
    ? context.roles.includes(privilegedRole)
    : true;
  const hasPendingRequest = privilegedRole
    ? context.pendingRoleRequests.some(
        (request) =>
          request.role === privilegedRole && request.status === "pending"
      )
    : false;

  const statusLabel = getRoleStatusLabel({
    role: offerRole,
    hasCreatorProfile: Boolean(creator),
    hasApprovedRole,
    hasPendingRequest,
    hasDraftListing: draftCount > 0,
    hasPublishedListing: publishedCount > 0,
  });

  const existingDomainIds = creator
    ? (
        await supabase
          .from("creator_domains")
          .select("domain_id")
          .eq("creator_id", creator.id)
      ).data?.map((row) => row.domain_id as string) ?? []
    : [];

  return (
    <PageLayout
      title={copy.title}
      description={copy.lead}
      size="narrow"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-sm font-medium text-[var(--foreground)]">
          Status: {statusLabel}
        </span>
        <p className="text-sm text-[var(--muted)]">Duurt ongeveer 2 minuten.</p>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      ) : null}

      <CardShell variant="default" padding="lg">
        <form action={saveOnboardingProfileAction} className="space-y-5">
          <input type="hidden" name="offer_role" value={offerRole} />
          <input type="hidden" name="country_code" value="BE" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="display_name"
              label="Naam"
              defaultValue={creator?.display_name ?? ""}
              placeholder="Bijv. Marie"
            />
            <Input
              name="business_name"
              label="Bedrijfsnaam (of ateliernaam)"
              defaultValue={creator?.business_name ?? ""}
              placeholder="Bijv. Marie's Haakatelier"
            />
          </div>
          <p className="text-xs text-[var(--muted)]">
            Vul naam of bedrijfsnaam in (minstens één). Je webadres maken we
            automatisch.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="city"
              label="Stad *"
              required
              defaultValue={creator?.city ?? ""}
              placeholder="Bijv. Mechelen"
            />
            <Input
              name="email"
              label="Contact e-mail *"
              type="email"
              required
              defaultValue={creator?.email ?? user.email ?? ""}
            />
          </div>

          <ImageUploadField
            name="avatar_file"
            label={`${copy.photoLabel} (aanbevolen)`}
            hint="Niet verplicht om verder te gaan. Helpt bezoekers je sneller herkennen."
            currentUrl={creator?.avatar_url}
            uploadPathPrefix={
              creator?.id ? `creators/${creator.id}/avatar` : "creators/avatar"
            }
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              Korte beschrijving *
            </span>
            <textarea
              name="bio"
              required
              rows={4}
              defaultValue={creator?.bio ?? ""}
              placeholder="Vertel kort wie je bent en wat je aanbiedt..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-[var(--foreground)]">
              Hobby / categorie *
            </legend>
            <div className="flex flex-wrap gap-2">
              {domains.map((domain) => {
                const checked = existingDomainIds.includes(domain.id);
                return (
                  <label
                    key={domain.id}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="domain_ids"
                      value={domain.id}
                      defaultChecked={checked}
                      className="size-4 accent-[var(--accent)]"
                    />
                    {domain.name}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit">{copy.cta}</Button>
            <Button asChild variant="secondary" type="button">
              <Link href="/profile">Dit later doen</Link>
            </Button>
          </div>
        </form>

        <form action={skipOfferOnboardingAction} className="mt-4">
          <button
            type="submit"
            className="text-sm text-[var(--muted)] underline hover:text-[var(--foreground)]"
          >
            Sla onboarding over en ga naar Mijn Hobbysalon
          </button>
        </form>
      </CardShell>
    </PageLayout>
  );
}
