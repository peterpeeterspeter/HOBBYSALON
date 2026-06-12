import { Sparkles, UserX, WifiOff } from "lucide-react";
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
    <Container className="py-8">
      <header className="mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--section-highlight)] to-[var(--card)] px-6 py-9 sm:px-9 sm:py-11">
        <p className="mb-2 text-sm font-bold uppercase tracking-widest text-[var(--accent)]">
          {tools.length} gratis tools
        </p>
        <h1 className="max-w-2xl font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight text-[var(--foreground)] sm:text-4xl">
          Tools voor breien, haken &amp; borduren
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Calculators en converters die het rekenwerk uit handen nemen — van
          garenhoeveelheid en stekenproef tot kleurconversie en projectplanning.
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          {PERKS.map((perk) => (
            <li
              key={perk.label}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"
            >
              <perk.icon size={16} className="text-[var(--accent)]" aria-hidden />
              {perk.label}
            </li>
          ))}
        </ul>
      </header>

      <ToolsBrowser tools={tools} />
    </Container>
  );
}
