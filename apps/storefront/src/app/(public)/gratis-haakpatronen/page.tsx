import Link from "next/link";
import type { Metadata } from "next";
import { ListingHeroBand } from "@/components/shared/ListingHeroBand";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
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
    "Verzameling van gratis Nederlandstalige haakpatronen. Curatie per bron, altijd gratis, altijd in het Nederlands.",
};

export default async function FreeDutchCrochetPatternsPage() {
  const [articles, leadMagnet] = await Promise.all([
    listFreeDutchCrochetPatternArticles(120),
    getActiveNewsletterLeadMagnet(HAAK_STARTPAKKET_CAMPAIGN_CODE),
  ]);

  return (
    <>
      <ListingHeroBand
        size="compact"
        title="Gratis Nederlandstalige haakpatronen"
        lead="Curatie van gratis haakpatronen in het Nederlands, per bron verzameld en regelmatig aangevuld. Altijd gratis, altijd in je eigen taal."
        imageSrc={LANDING_IMAGES.domainCrochet}
        breadcrumb={
          <nav aria-label="Breadcrumb" className="text-sm text-white/75">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/patronen" className="hover:text-white">
                  Patronen
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-white">Gratis NL haakpatronen</li>
            </ol>
          </nav>
        }
        footer={
          articles.length > 0 ? (
            <p className="text-sm font-semibold text-white/85">
              {articles.length} patroon{articles.length !== 1 ? "en" : ""} beschikbaar
            </p>
          ) : undefined
        }
      />

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
