import { redirect } from "next/navigation";
import { createWorkshopAction } from "@/app/actions/dashboard";
import { getDashboardContext } from "@/lib/dashboard/load";
import { loadOfferFormOptions } from "@/lib/dashboard/form-options";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { Button } from "@/components/ui/button";
import { DashboardPageHeader, FlashMessage } from "@/components/dashboard/ui";
import { FormActions } from "@/components/dashboard/form";
import { WorkshopFormFields } from "@/components/dashboard/WorkshopFormFields";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewWorkshopPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const { creator, caps } = await getDashboardContext("/dashboard/workshops/nieuw");
  requireDashboardCapability(caps.canDraftWorkshops);
  if (!creator) {
    redirect("/dashboard/pagina");
  }

  const options = await loadOfferFormOptions(creator.id);

  return (
    <div className="max-w-4xl">
      <DashboardPageHeader
        title="Nieuwe workshop"
        lead="Drie korte stappen. Je kan alles later nog aanpassen."
        back={{ href: "/dashboard/aanbod?soort=workshops", label: "Terug naar mijn aanbod" }}
      />
      <FlashMessage error={error} />
      <form action={createWorkshopAction} encType="multipart/form-data">
        <input type="hidden" name="return_to" value="/dashboard/workshops/nieuw" />
        <WorkshopFormFields
          creatorId={creator.id}
          categories={options.workshopCategories}
          domainOptions={options.domainOptions}
          primaryDomainId={options.primaryDomainId}
          canPublish={caps.canPublishWorkshops}
          withFirstDate
        />
        <FormActions>
          <Button type="submit" size="lg">
            Workshop bewaren
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
