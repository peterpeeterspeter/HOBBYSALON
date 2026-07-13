import { NewsletterSignupForm } from "@/components/shared/NewsletterSignupForm";
import type { ActiveNewsletterLeadMagnet } from "@/lib/platform/queries/newsletter-lead-magnets";

type LeadMagnetCalloutProps = {
  campaign: ActiveNewsletterLeadMagnet;
  sourcePath: string;
};

/** A reusable, server-rendered callout for an already-validated lead-magnet campaign. */
export function LeadMagnetCallout({
  campaign,
  sourcePath,
}: LeadMagnetCalloutProps) {
  return (
    <section
      aria-labelledby="lead-magnet-title"
      className="rounded-2xl border-2 border-[var(--accent)]/25 bg-[var(--section-highlight)] p-5 shadow-[0_10px_24px_rgb(38_58_47_/_0.08)] sm:p-7"
    >
      <div className="max-w-2xl">
        <p className="text-base font-semibold text-[var(--accent)]">
          Gratis voor beginnende haaksters
        </p>
        <h2
          id="lead-magnet-title"
          className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl"
        >
          {campaign.title}
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-[var(--muted)]">
          Ontvang een rustige, duidelijke startgids met handige eerste stappen voor
          haken. Vul uw e-mailadres in en bevestig daarna uw inschrijving.
        </p>
      </div>

      <div className="mt-5 max-w-2xl">
        <NewsletterSignupForm
          leadMagnetCode={campaign.code}
          sourcePath={sourcePath}
        />
      </div>
    </section>
  );
}
