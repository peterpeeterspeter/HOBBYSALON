import { redirect } from "next/navigation";
import { createEventAction } from "@/app/actions/dashboard";
import { getDashboardContext } from "@/lib/dashboard/load";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { getDashboardCommercialContext } from "@/lib/platform/commercial-enforcement";
import { isCommercialGatingEnabled } from "@/lib/platform/commercial-entitlements";
import { getEventCreditCost } from "@/lib/platform/listing-credits";
import { Button } from "@/components/ui/button";
import { DashboardPageHeader, FlashMessage } from "@/components/dashboard/ui";
import { FormActions } from "@/components/dashboard/form";
import { EventFormFields } from "@/components/dashboard/EventFormFields";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewEventPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const { creator, caps } = await getDashboardContext("/dashboard/events/nieuw");
  requireDashboardCapability(caps.canDraftEvents);
  if (!creator) {
    redirect("/dashboard/pagina");
  }

  const commercial = await getDashboardCommercialContext(creator.id, creator.creator_types ?? []);
  const gating = isCommercialGatingEnabled();

  return (
    <div className="max-w-4xl">
      <DashboardPageHeader
        title="Nieuw event"
        lead="Drie korte stappen. Je kan alles later nog aanpassen."
        back={{ href: "/dashboard/aanbod?soort=events", label: "Terug naar mijn aanbod" }}
      />
      <FlashMessage error={error} />
      <form action={createEventAction} encType="multipart/form-data">
        <input type="hidden" name="return_to" value="/dashboard/events/nieuw" />
        <EventFormFields
          creatorId={creator.id}
          canPublish={caps.canPublishEvents}
          allowExternalTickets={Boolean(commercial.allowExternalLinks)}
          typeCostLabel={gating ? (type) => ` (${getEventCreditCost(type)} credits)` : undefined}
        />
        <FormActions>
          <Button type="submit" size="lg">
            Event bewaren
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
