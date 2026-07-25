import { CreatorDashboardTabs } from "@/components/dashboard/creator/CreatorDashboardTabs";
import { CreatorDashboardHeader } from "@/components/dashboard/creator/CreatorDashboardHeader";
import { CreatorProfileTab } from "@/components/dashboard/creator/CreatorProfileTab";
import { CreatorArticlesTab } from "@/components/dashboard/creator/CreatorArticlesTab";
import { CreatorPortfolioTab } from "@/components/dashboard/creator/CreatorPortfolioTab";
import { CardShell } from "@/components/ui/card-shell";
import type { CreatorMakerData } from "@/lib/profile/load-creator-maker-data";

type CreatorMakerSectionProps = {
  data: CreatorMakerData;
  success?: string;
  error?: string;
};

export function CreatorMakerSection({ data, success, error }: CreatorMakerSectionProps) {
  const {
    creator,
    registrationContext,
    onboarding,
    accountDisplayName,
    domains,
    activeTab,
    selectedDomainIds,
    dashboardArticles,
    articleSuggestionsByArticle,
    articleConfirmedByArticle,
    creatorProjects,
    projectImagesByProject,
    projectLinksByProject,
    projectSoughtMaterialsByProject,
    productLabels,
    workshopLabels,
    eventLabels,
    materialProductOptions,
    progressSteps,
  } = data;

  const allDone =
    progressSteps.length > 0 && progressSteps.every((step) => step.done);
  const forceOpen =
    Boolean(success) || Boolean(error) || activeTab !== "profiel" || !allDone;

  const editor = (
    <>
      {success && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-base text-green-800">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      )}

      <CreatorDashboardTabs
        activeTab={activeTab}
        preserveQuery={{ success, error }}
        basePath="/profile"
      >
        {activeTab === "profiel" && (
          <CreatorProfileTab
            creator={creator}
            onboarding={onboarding}
            accountDisplayName={accountDisplayName}
            registrationCity={registrationContext?.preference?.city ?? null}
            registrationCountryCode={registrationContext?.preference?.countryCode ?? null}
            domains={domains}
            selectedDomainIds={selectedDomainIds}
          />
        )}

        {activeTab === "artikels" && creator && (
          <CreatorArticlesTab
            domains={domains}
            articles={dashboardArticles}
            articleSuggestionsByArticle={articleSuggestionsByArticle}
            articleConfirmedByArticle={articleConfirmedByArticle}
            productLabels={productLabels}
            workshopLabels={workshopLabels}
            eventLabels={eventLabels}
          />
        )}

        {activeTab === "artikels" && !creator && (
          <p className="text-base text-[var(--muted)]">
            Sla eerst je profiel op in het tabblad Profiel voordat je artikels kunt schrijven.
          </p>
        )}

        {activeTab === "portfolio" && creator && (
          <CreatorPortfolioTab
            projects={creatorProjects}
            projectImagesByProject={projectImagesByProject}
            projectLinksByProject={projectLinksByProject}
            projectSoughtMaterialsByProject={projectSoughtMaterialsByProject}
            materialProductOptions={materialProductOptions}
            ownProductLabels={productLabels}
          />
        )}

        {activeTab === "portfolio" && !creator && (
          <p className="text-base text-[var(--muted)]">
            Sla eerst je profiel op in het tabblad Profiel voordat je je portfolio kunt beheren.
          </p>
        )}
      </CreatorDashboardTabs>
    </>
  );

  return (
    <section id="maker-pagina" className="mt-10 scroll-mt-24" aria-labelledby="maker-pagina-heading">
      <CardShell variant="default" padding="lg" className="space-y-6">
        <CreatorDashboardHeader
          creatorSlug={creator?.slug ?? null}
          progressSteps={progressSteps}
          compact
        />

        {forceOpen ? (
          editor
        ) : (
          <details className="group rounded-lg border border-[var(--border)] bg-[var(--background)]">
            <summary className="cursor-pointer list-none px-4 py-4 text-base font-semibold text-[var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {creator?.display_name
                    ? `Profiel van ${creator.display_name} is klaar`
                    : "Je makerpagina is klaar"}
                </span>
                <span className="text-[var(--accent)] group-open:hidden">Bewerken</span>
                <span className="hidden text-[var(--muted)] group-open:inline">Sluiten</span>
              </span>
            </summary>
            <div className="space-y-6 border-t border-[var(--border)] px-4 py-5">{editor}</div>
          </details>
        )}
      </CardShell>
    </section>
  );
}
