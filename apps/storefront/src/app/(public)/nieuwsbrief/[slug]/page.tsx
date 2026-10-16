import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { getPublishedNewsletterIssueBySlug } from "@/lib/newsletter/issues";
import { buildPageMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const issue = await getPublishedNewsletterIssueBySlug(slug).catch(() => null);
  if (!issue) {
    return buildPageMetadata({
      title: "Nieuwsbrief | Hobbysalon",
      description: "Archiefeditie van de Hobbysalon-nieuwsbrief.",
      path: `/nieuwsbrief/${slug}`,
    });
  }
  return buildPageMetadata({
    title: `${issue.title} | Nieuwsbrief Hobbysalon`,
    description:
      issue.excerpt ??
      issue.subject ??
      "Archiefeditie van de wekelijkse Hobbysalon-nieuwsbrief.",
    path: `/nieuwsbrief/${issue.slug}`,
  });
}

function formatIssueDate(iso: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    timeZone: "Europe/Brussels",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function NieuwsbriefIssuePage({ params }: PageProps) {
  const { slug } = await params;
  const issue = await getPublishedNewsletterIssueBySlug(slug).catch(() => null);
  if (!issue) notFound();

  return (
    <>
      <section className="border-b border-[var(--border)] bg-[var(--section-alt)]">
        <Container className="py-8 sm:py-10">
          <nav aria-label="Breadcrumb" className="text-base text-[var(--muted)]">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-[var(--foreground)]">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href="/nieuwsbrief"
                  className="hover:text-[var(--foreground)]"
                >
                  Nieuwsbrief
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-[var(--foreground)] line-clamp-1">
                {issue.title}
              </li>
            </ol>
          </nav>
          <p className="mt-5 text-base font-semibold capitalize text-[var(--accent)]">
            {formatIssueDate(issue.published_at)}
            {issue.theme ? ` · ${issue.theme}` : null}
          </p>
          <h1 className="mt-2 max-w-3xl font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight tracking-[-0.035em] text-[var(--foreground)] sm:text-4xl">
            {issue.title}
          </h1>
        </Container>
      </section>

      <Container className="py-8 sm:py-10">
        <article
          className="newsletter-issue mx-auto max-w-[640px] overflow-x-auto text-lg leading-relaxed text-[var(--foreground)] [&_a]:text-[var(--accent)] [&_a]:underline [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_p]:my-3"
          dangerouslySetInnerHTML={{ __html: issue.html }}
        />

        <p className="mx-auto mt-10 max-w-[640px] text-lg">
          <Link
            href="/nieuwsbrief"
            className="inline-flex min-h-12 items-center font-bold text-[var(--accent)] underline underline-offset-4"
          >
            Terug naar de nieuwsbrief
          </Link>
        </p>
      </Container>
    </>
  );
}
