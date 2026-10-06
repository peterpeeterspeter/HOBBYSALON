import { redirect } from "next/navigation";
import { createProductAction } from "@/app/actions/dashboard";
import { getDashboardContext } from "@/lib/dashboard/load";
import { loadOfferFormOptions } from "@/lib/dashboard/form-options";
import { loadCreationCategories } from "@/lib/dashboard/creation-options";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { Button } from "@/components/ui/button";
import { DashboardPageHeader, FlashMessage } from "@/components/dashboard/ui";
import { FormActions } from "@/components/dashboard/form";
import { CreationFormFields } from "@/components/dashboard/CreationFormFields";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewCreationPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const { creator, caps } = await getDashboardContext("/dashboard/products/nieuw");
  requireDashboardCapability(caps.canManageProducts);
  if (!creator) {
    redirect("/dashboard/pagina");
  }

  const [options, categories] = await Promise.all([
    loadOfferFormOptions(creator.id),
    loadCreationCategories(),
  ]);

  return (
    <div className="max-w-4xl">
      <DashboardPageHeader
        title="Nieuwe creatie"
        lead="Drie korte stappen. Je kan alles later nog aanpassen."
        back={{ href: "/dashboard/aanbod?soort=creaties", label: "Terug naar mijn aanbod" }}
      />
      <FlashMessage error={error} />
      <form action={createProductAction} encType="multipart/form-data">
        <input type="hidden" name="return_to" value="/dashboard/products/nieuw" />
        <CreationFormFields
          creatorId={creator.id}
          domainOptions={options.domainOptions}
          categories={categories}
          primaryDomainId={options.primaryDomainId}
        />
        <FormActions>
          <Button type="submit" size="lg">
            Creatie bewaren
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
