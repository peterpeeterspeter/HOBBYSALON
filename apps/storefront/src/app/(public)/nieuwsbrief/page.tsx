import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterSignupForm } from "@/components/shared/NewsletterSignupForm";
import { Container } from "@/components/ui/container";
import { listPublishedNewsletterIssues } from "@/lib/newsletter/issues";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Nieuwsbrief | Hobbysalon",
  description:
    "Elke donderdag gratis creatieve inspiratie: haken, breien, kaarten, naaien en juwelen, plus workshops, events en een gratis patroon of tool.",
  path: "/nieuwsbrief",
});

const THEMES = [
  "haken",
  "breien",
  "kaarten maken",
  "naaien",
  "juwelen",
] as const;

function formatIssueDate(iso: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    timeZone: "Europe/Brussels",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function NieuwsbriefPage() {
  const issues = await listPublishedNewsletterIssues(10).catch(() => []);

  return (
    <>
      <section className="border-b border-[var(--border)] bg-[var(--section-alt)]">
        <Container className="py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="text-base text-[var(--muted)]">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-[var(--foreground)]">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-[var(--foreground)]">Nieuwsbrief</li>
            </ol>
          </nav>

          <p className="mt-6 font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--accent)] sm:text-3xl">
            Hobbysalon
          </p>
          <h1 className="mt-2 max-w-3xl font-[family-name:var(--font-heading)] text-4xl font-bold leading-[1.15] tracking-[-0.035em] text-[var(--foreground)] sm:text-5xl">
            Wekelijkse nieuwsbrief
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Elke donderdag krijg je gratis creatieve inspiratie in je inbox.
            Altijd uitschrijfbaar, zonder gedoe.
          </p>
        </Container>
      </section>

      <Container className="flex flex-col gap-14 py-10 sm:gap-16 sm:py-14">
        <section aria-labelledby="wat-krijg-je">
          <h2
            id="wat-krijg-je"
            className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl"
          >
            Wat krijg je elke week?
          </h2>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Een rustige mail met duidelijke tips, geen rommel. We wisselen elk
            week een thema af:
          </p>
          <ul className="mt-5 max-w-2xl list-disc space-y-2 pl-6 text-lg leading-relaxed text-[var(--foreground)]">
            <li>
              Thema van de week: {THEMES.join(", ")} (om de beurt)
            </li>
            <li>Workshops en events bij jou in de buurt</li>
            <li>Eén gratis patroon of handige tool</li>
          </ul>
        </section>

        <section
          aria-labelledby="inschrijven"
          className="rounded-[1.25rem] border-2 border-[var(--accent)]/30 bg-[var(--section-highlight)] p-6 sm:p-8"
        >
          <h2
            id="inschrijven"
            className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl"
          >
            Schrijf je in
          </h2>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Vul je e-mailadres in. Je krijgt eerst een bevestigingsmail. Pas na
            je bevestiging ben je ingeschreven.
          </p>
          <div className="mt-6 max-w-xl">
            <NewsletterSignupForm variant="page" />
          </div>
        </section>

        <section aria-labelledby="archief">
          <h2
            id="archief"
            className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl"
          >
            Archief
          </h2>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Eerdere edities kun je hier rustig nalezen.
          </p>

          {issues.length === 0 ? (
            <p className="mt-6 text-lg text-[var(--muted)]">
              Er staat nog geen editie in het archief. De eerste verschijnt na
              verzending.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={`/nieuwsbrief/${issue.slug}`}
                    className="block py-5 transition-colors hover:bg-[var(--section-highlight)]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    <p className="text-base font-semibold text-[var(--accent)]">
                      {formatIssueDate(issue.published_at)}
                      {issue.theme ? ` · ${issue.theme}` : null}
                    </p>
                    <h3 className="mt-1 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] sm:text-2xl">
                      {issue.title}
                    </h3>
                    {issue.excerpt ? (
                      <p className="mt-2 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
                        {issue.excerpt}
                      </p>
                    ) : null}
                    <span className="mt-3 inline-flex min-h-12 items-center text-lg font-bold text-[var(--accent)] underline underline-offset-4">
                      Lees deze editie
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </>
  );
}
