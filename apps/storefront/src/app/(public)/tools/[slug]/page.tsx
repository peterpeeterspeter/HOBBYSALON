import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { RelatedTools } from "@/components/tools/RelatedTools";
import { buildPageMetadata } from "@/lib/seo";
import { getToolBySlug, getRelatedTools, getAllTools } from "@/lib/tools/registry";
import { buildToolFaqSchema } from "@/lib/tools/engine";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllTools().map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Tool niet gevonden | Hobbysalon" };
  return buildPageMetadata({
    title: `${tool.title} | Hobbysalon`,
    description: tool.description,
    path: `/tools/${slug}`,
  });
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const ToolComponent = tool.component;
  const relatedTools = getRelatedTools(slug);
  const faqSchema = buildToolFaqSchema(tool.faqs);

  return (
    <ToolLayout
      title={tool.title}
      description={tool.description}
      categoryLabel={tool.categoryLabel}
    >
      {faqSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}

      <div className="max-w-3xl">
        <ToolComponent />

        {tool.relatedHubHref && tool.relatedHubLabel ? (
          <p className="mt-6 text-base text-[var(--muted)]">
            Meer inspiratie?{" "}
            <Link
              href={tool.relatedHubHref}
              className="font-semibold text-[var(--accent)] hover:underline"
            >
              {tool.relatedHubLabel}
            </Link>
          </p>
        ) : null}

        {tool.faqs && tool.faqs.length > 0 ? (
          <section className="mt-12 border-t border-[var(--border)] pt-10">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
              Veelgestelde vragen
            </h2>
            <span
              className="mt-2 block h-[3px] w-10 rounded-full bg-[var(--accent)]"
              aria-hidden
            />
            <dl className="mt-6 space-y-6">
              {tool.faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5"
                >
                  <dt className="text-lg font-semibold text-[var(--foreground)]">
                    {faq.question}
                  </dt>
                  <dd className="mt-2 text-base leading-relaxed text-[var(--muted)]">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>

      <RelatedTools tools={relatedTools} categoryLabel={tool.categoryLabel} />
    </ToolLayout>
  );
}
