import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/layout/section";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Hobbysalon | Creatief platform voor hobbyisten",
  description:
    "Ontdek makers, workshops, handgemaakte producten en inspiratie. Jouw creatieve hobby community.",
  path: "/landing",
});

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--foreground)] text-[var(--background)]">
        <div className="absolute inset-0">
          <Image
            src="/landing/hero.jpg"
            alt="Creatieve workshop"
            fill
            className="object-cover opacity-70"
            priority
            sizes="100vw"
          />
        </div>
        <div className="relative">
          <Container className="py-24 md:py-32">
            <h1 className="max-w-2xl text-4xl font-bold leading-tight font-[family-name:var(--font-heading)] md:text-6xl">
              Creatieve hobby&apos;s ontdekken.
              <br />
              <span className="text-[var(--accent)]">Makers verbinden.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg md:text-xl opacity-95">
              Hobbysalon is jouw platform voor handgemaakte producten, workshops,
              evenementen en inspiratie. Vind makers, leer nieuwe vaardigheden en
              deel je creativiteit.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
              >
                <Link href="/">Verken Hobbysalon</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20"
              >
                <Link href="/workshops">Workshops</Link>
              </Button>
            </div>
          </Container>
        </div>
      </section>

      {/* Features */}
      <Section spacing="lg">
        <Container>
          <h2 className="text-center text-3xl font-bold text-[var(--foreground)] font-[family-name:var(--font-heading)] md:text-4xl">
            Wat je op Hobbysalon vindt
          </h2>
          <span className="mx-auto mt-3 block h-[3px] w-10 rounded-full bg-[var(--accent)]" aria-hidden="true" />
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-[var(--muted)]">
            Van breien tot keramiek, van makers tot leveranciers.
          </p>

          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {[
              {
                image: "/landing/crafts-grid.jpg",
                imageAlt: "Handgemaakte producten",
                title: "Handgemaakt & benodigdheden",
                description: "Vind unieke producten van makers en betrouwbare leveranciers.",
                linkHref: "/crochet",
                linkText: "Verken producten",
              },
              {
                image: "/landing/workshop.jpg",
                imageAlt: "Workshop",
                title: "Workshops & events",
                description: "Leer van experts en ontmoet andere hobbyisten.",
                linkHref: "/workshops",
                linkText: "Bekijk agenda",
              },
              {
                image: "/landing/community.jpg",
                imageAlt: "Community",
                title: "Community",
                description: "Ontdek creators, volg favorieten en deel je projecten.",
                linkHref: "/creators",
                linkText: "Ontdek makers",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)] transition-all duration-[var(--transition-normal)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] motion-reduce:hover:transform-none"
              >
                <div className="aspect-[4/3] relative overflow-hidden">
                  <Image
                    src={feature.image}
                    alt={feature.imageAlt}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:group-hover:transform-none"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-[var(--muted)]">
                    {feature.description}
                  </p>
                  <Link
                    href={feature.linkHref}
                    className="group/link mt-4 inline-flex items-center gap-1 text-[var(--accent)] font-medium hover:underline"
                  >
                    {feature.linkText}
                    <span className="transition-transform duration-[var(--transition-fast)] group-hover/link:translate-x-1" aria-hidden="true">
                      &rarr;
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Stats */}
      <Section variant="alt" spacing="md" divider>
        <Container>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: "500+", label: "Makers & leveranciers" },
              { value: "15+", label: "Creatieve domeinen" },
              { value: "200+", label: "Workshops per jaar" },
              { value: "10K+", label: "Leden" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-[var(--accent)] font-[family-name:var(--font-heading)] md:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section variant="highlight" spacing="lg">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-[var(--foreground)] font-[family-name:var(--font-heading)]">
              Start vandaag
            </h2>
            <span className="mx-auto mt-3 block h-[3px] w-10 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            <p className="mt-4 text-lg text-[var(--muted)]">
              Verken domeinen, volg makers en ontdek je volgende hobby.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/">Ga naar Hobbysalon</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </div>
  );
}
