import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { createEventAction } from "@/app/actions/dashboard";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Eerste evenement | Hobbysalon",
};

export default async function OnboardingEventPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/onboarding/event");
  }

  const [creator, context] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
  ]);

  if (!creator) {
    redirect("/onboarding");
  }

  const caps = resolveDashboardCapabilities({
    registrationContext: context,
    creatorTypes: creator.creator_types,
    hasCreatorProfile: true,
  });

  if (!caps.canDraftEvents) {
    redirect("/onboarding");
  }

  const starts = new Date();
  starts.setDate(starts.getDate() + 14);
  starts.setMinutes(0, 0, 0);
  const ends = new Date(starts);
  ends.setHours(ends.getHours() + 6);
  const toLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  return (
    <PageLayout
      title="Voeg je eerste evenement toe"
      description="Sla op als concept. Publiceren kan na goedkeuring van je organisatorrol."
      size="narrow"
    >
      {!caps.canPublishEvents ? (
        <CardShell
          variant="featured"
          padding="md"
          className="mb-6 border-amber-300 bg-amber-50"
        >
          <p className="font-semibold text-amber-950">Status: In beoordeling</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Je concept wordt bewaard. Publiceren volgt op goedkeuring.
          </p>
        </CardShell>
      ) : null}

      <CardShell padding="lg">
        <form action={createEventAction} className="space-y-4">
          <input type="hidden" name="onboarding_next" value="/onboarding/success?role=organizer" />
          <Input name="title" label="Titel *" required />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Type *</span>
            <select
              name="event_type"
              required
              defaultValue="handmade_market"
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3"
            >
              <option value="handmade_market">Handmade markt</option>
              <option value="hobby_fair">Hobbybeurs</option>
              <option value="open_atelier">Open atelier</option>
              <option value="pop_up">Popup</option>
              <option value="workshop_day">Workshopdag</option>
            </select>
          </label>
          <input type="hidden" name="ticketing_mode" value="none" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="starts_at"
              label="Start *"
              type="datetime-local"
              required
              defaultValue={toLocal(starts)}
            />
            <Input
              name="ends_at"
              label="Einde *"
              type="datetime-local"
              required
              defaultValue={toLocal(ends)}
            />
          </div>
          <Input name="city" label="Stad" defaultValue={creator.city ?? ""} />
          <Input name="location_name" label="Locatie" />
          <Button type="submit">Opslaan als concept</Button>
        </form>
      </CardShell>
    </PageLayout>
  );
}
