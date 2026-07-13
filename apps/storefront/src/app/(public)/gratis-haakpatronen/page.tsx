import Link from "next/link";
import type { Metadata } from "next";
import { Scissors } from "lucide-react";
import { ArticleCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { listFreeDutchCrochetPatternArticles } from "@/lib/platform/queries/articles";
import { LeadMagnetCallout } from "@/components/shared/LeadMagnetCallout";
import { getActiveNewsletterLeadMagnet } from "@/lib/platform/queries/newsletter-lead-magnets";

const HAAK_STARTPAKKET_CAMPAIGN_CODE = "haak-startpakket-v1";

export const metadata: Metadata = {
  title: "Gratis Nederlandstalige haakpatronen | Hobbysalon",
  description:
    "Verzameling van gratis Nederlandstalige haakpatronen — curatie per bron, altijd gratis, altijd in het Nederlands.",
};

export default async function FreeDutchCrochetPatternsPage() {
  const [articles, leadMagnet] = await Promise.all([
    listFreeDutchCrochetPatternArticles(120),
    getActiveNewsletterLeadMagnet(HAAK_STARTPAKKET_CAMPAIGN_CODE),
  ]);

  return (
    <>
      {/* Hero */}
      <div className="bg-gradient-to-br from-[var(--section-highlight)] to-[var(--card)] border-b border-[var(--border)]">
        <Container className="py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-[var(--foreground)]">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li className="text-[var(--foreground)]">Gratis NL haakpatronen</li>
            </ol>
          </nav>

          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <Scissors size={24} aria-hidden />
            </span>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight text-[var(--foreground)] sm:text-4xl">
                Gratis Nederlandstalige haakpatronen
              </h1>
              <p className="mt-2 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
                Curatie van gratis haakpatronen in het Nederlands — per bron
                verzameld en regelmatig aangevuld. Altijd gratis, altijd in je
                eigen taal.
              </p>
              {articles.length > 0 && (
                <p className="mt-3 text-sm font-semibold text-[var(--accent)]">
                  {articles.length} patroon{articles.length !== 1 ? "en" : ""} beschikbaar
                </p>
              )}
            </div>
          </div>
        </Container>
      </div>

      {/* Content */}
      <Container className="py-10">
        {leadMagnet?.code === HAAK_STARTPAKKET_CAMPAIGN_CODE && (
          <div className="mb-10">
            <LeadMagnetCallout
              campaign={leadMagnet}
              sourcePath="/gratis-haakpatronen"
            />
          </div>
        )}

        {articles.length === 0 ? (
          <EmptyState
            title="Nog geen patronen toegevoegd"
            description="Patronen worden regelmatig geïmporteerd en gecureerd. Kom later terug!"
            action={{ label: "Naar home", href: "/" }}
          />
        ) : (
          <GridLayout cols={3} gap="lg">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </GridLayout>
        )}
      </Container>
    </>
  );
}
