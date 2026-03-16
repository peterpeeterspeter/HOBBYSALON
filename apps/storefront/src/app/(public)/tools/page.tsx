import Link from "next/link";
import { Container } from "@/components/ui/container";
import { CardShell } from "@/components/ui/card-shell";
import { buildPageMetadata } from "@/lib/seo";
import { getToolsByCategory } from "@/lib/tools/registry";

export const metadata = buildPageMetadata({
  title: "Tools | Hobbysalon",
  description:
    "Gratis calculators en converters voor breien, haken en borduren: garencalculator, naaldmaat converter, stekenproef, C2C-deken, foto naar kruissteek en meer.",
  path: "/tools",
});

const CATEGORY_ORDER: Array<{ id: string; label: string }> = [
  { id: "garen-draad", label: "Garen & draad" },
  { id: "maat-stekenproef", label: "Maat, stekenproef & patroongrootte" },
  { id: "naaldmaat", label: "Naaldmaat & haaknaald" },
  { id: "kleur", label: "Kleur & draadkleur" },
  { id: "patroon", label: "Patroonmaking & grafieken" },
  { id: "planning", label: "Projectplanning" },
  { id: "breien", label: "Breien specifiek" },
  { id: "haken", label: "Haken specifiek" },
  { id: "borduren", label: "Borduren & naaldwerk" },
];

export default function ToolsHubPage() {
  const byCategory = getToolsByCategory();

  return (
    <Container className="py-8">
      <header className="mb-10">
        <h1 className="text-4xl font-bold text-[var(--foreground)]">
          Tools voor breien, haken & borduren
        </h1>
        <p className="mt-3 text-lg text-[var(--muted)]">
          Gratis calculators en converters. Geen account nodig, alles werkt in je
          browser.
        </p>
      </header>

      <div className="space-y-10">
        {CATEGORY_ORDER.map((cat) => {
          const tools = byCategory.get(cat.id as Parameters<typeof byCategory.get>[0]);
          if (!tools?.length) return null;

          return (
            <section key={cat.id}>
              <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">
                {cat.label}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="block"
                  >
                    <CardShell
                      variant="interactive"
                      padding="lg"
                      className="h-full"
                    >
                      <h3 className="font-semibold text-[var(--foreground)]">
                        {tool.title}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                        {tool.description}
                      </p>
                    </CardShell>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Container>
  );
}
