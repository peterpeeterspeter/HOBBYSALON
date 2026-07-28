import Link from "next/link";
import { Sparkles, UserX, WifiOff } from "lucide-react";
import { ListingHeroBand } from "@/components/shared/ListingHeroBand";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { Container } from "@/components/ui/container";
import { ToolsBrowser } from "@/components/tools/ToolsBrowser";
import { buildPageMetadata } from "@/lib/seo";
import { getToolSummaries } from "@/lib/tools/registry";

export const metadata = buildPageMetadata({
  title: "Tools | Hobbysalon",
  description:
    "Gratis calculators en converters voor breien, haken en borduren: garencalculator, naaldmaat converter, stekenproef, C2C-deken, foto naar kruissteek en meer.",
  path: "/tools",
});

const PERKS = [
  { icon: Sparkles, label: "Gratis te gebruiken" },
  { icon: UserX, label: "Geen account nodig" },
  { icon: WifiOff, label: "Werkt in je browser" },
];

export default function ToolsHubPage() {
  const tools = getToolSummaries();

  return (
    <>
      <ListingHeroBand
        size="compact"
        title="Tools voor breien, haken & borduren"
        lead="Calculators en converters die het rekenwerk uit handen nemen: van garenhoeveelheid en stekenproef tot kleurconversie en projectplanning."
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
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li className="text-sm font-semibold text-white/90">
              {tools.length} gratis tools
            </li>
            {PERKS.map((perk) => (
              <li
                key={perk.label}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/85"
              >
                <perk.icon size={16} aria-hidden />
                {perk.label}
              </li>
            ))}
          </ul>
        }
      />

      <Container className="py-8">
        <ToolsBrowser tools={tools} />
      </Container>
    </>
  );
}
