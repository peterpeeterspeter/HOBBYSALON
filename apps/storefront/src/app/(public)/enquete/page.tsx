import { AanbodSurveyForm } from "@/components/survey/AanbodSurveyForm";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Enquête: help het aanbod van Hobbysalon verbeteren",
  description:
    "Deel uw feedback als maker, workshopgever, webshop of organisator. Invullen duurt 3 tot 5 minuten.",
  path: "/enquete",
});

export default function EnquetePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Enquête</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
          Help het aanbod van Hobbysalon verbeteren
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Selecteer alle rollen die op u van toepassing zijn. Per rol stellen we een paar gerichte vragen.
        </p>
      </header>

      <AanbodSurveyForm />
    </div>
  );
}
