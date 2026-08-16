import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ListingHeroBand } from "@/components/shared/ListingHeroBand";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { Container } from "@/components/ui/container";
import { ToolsBrowser } from "@/components/tools/ToolsBrowser";
import { buildPageMetadata } from "@/lib/seo";
import { getToolSummaries } from "@/lib/tools/registry";

export const metadata = buildPageMetadata({
  title: "Tools | Hobbysalon",
  description:
    "Gratis calculators voor hobbyisten: stof, quilt, kaarsenwas, resin, kralen, papier snijden, workshop break-even, plus breien, haken en borduren.",
  path: "/tools",
});

export default function ToolsHubPage() {
  const tools = getToolSummaries();

  return (
    <>
      <ListingHeroBand
        size="compact"
        title="Hobbysalon Tools"
        lead="Bereken wat je nodig hebt voor je project — stof, garen, was, hars, kralen of je workshopprijs. Gratis, zonder account."
        imageSrc={LANDING_IMAGES.craftsGrid}
        breadcrumb={
          <nav aria-label="Breadcrumb" className="text-sm text-white/75">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-white">Tools</li>
            </ol>
          </nav>
        }
        footer={
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/90">
            <Sparkles size={16} aria-hidden />
            {tools.length} gratis calculators · werkt in je browser
          </p>
        }
      />

      <section className="border-b border-[var(--border)] bg-[var(--background)]">
        <Container className="py-10 sm:py-12">
          <ToolsBrowser tools={tools} />
        </Container>
      </section>
    </>
  );
}
