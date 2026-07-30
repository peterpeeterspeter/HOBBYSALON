import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { createWorkshopAction } from "@/app/actions/dashboard";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Eerste workshop | Hobbysalon",
};

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function OnboardingWorkshopPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/onboarding/workshop");
  }

  const { error, success } = await searchParams;
  const [creator, context, domains] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
    listDomainsBySort(),
  ]);

  if (!creator) {
    redirect("/onboarding");
  }

  const caps = resolveDashboardCapabilities({
    registrationContext: context,
    creatorTypes: creator.creator_types,
    hasCreatorProfile: true,
  });

  if (!caps.canDraftWorkshops) {
    redirect("/onboarding");
  }

  return (
    <PageLayout
      title="Voeg je eerste workshop toe"
      description="Sla op als concept. Publiceren kan zodra je rol is goedgekeurd."
      size="narrow"
    >
      {!caps.canPublishWorkshops ? (
        <CardShell
          variant="featured"
          padding="md"
          className="mb-6 border-amber-300 bg-amber-50"
        >
          <p className="font-semibold text-amber-950">Status: In beoordeling</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Je kunt al een concept opslaan. Publiceren wordt mogelijk nadat we
            je workshopgeverrol hebben goedgekeurd.
          </p>
        </CardShell>
      ) : null}

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

      <CardShell padding="lg">
        <form action={createWorkshopAction} className="space-y-4">
          <input type="hidden" name="onboarding_next" value="/onboarding/success?role=workshopgever" />
          <Input name="title" label="Titel *" required placeholder="Bijv. Beginnen met haken" />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Korte beschrijving</span>
            <textarea
              name="short_description"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
              placeholder="Wat leren deelnemers?"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Vorm *</span>
              <select
                name="format_type"
                required
                defaultValue="physical"
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3"
              >
                <option value="physical">Fysiek</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybride</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Niveau *</span>
              <select
                name="difficulty_level"
                required
                defaultValue="beginner"
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Gevorderd</option>
                <option value="advanced">Expert</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Hobby / categorie</span>
            <select
              name="domain_id"
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3"
              defaultValue=""
            >
              <option value="">Kies een categorie</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="session_starts_at"
              label="Start *"
              type="datetime-local"
              required
            />
            <Input
              name="session_ends_at"
              label="Einde *"
              type="datetime-local"
              required
            />
          </div>
          <Input name="city" label="Stad" defaultValue={creator.city ?? ""} />
          <Input name="price_euro" label="Prijs (euro)" placeholder="45.00" />
          <Button type="submit">Opslaan als concept</Button>
        </form>
      </CardShell>
    </PageLayout>
  );
}
