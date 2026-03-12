import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
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
            <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-6xl">
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
      <section className="py-20">
        <Container>
          <h2 className="text-center text-3xl font-bold text-[var(--foreground)] md:text-4xl">
            Wat je op Hobbysalon vindt
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-[var(--muted)]">
            Van breien tot keramiek, van makers tot leveranciers.
          </p>

          <div className="mt-16 grid gap-12 md:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]">
              <div className="aspect-[4/3] relative">
                <Image
                  src="/landing/crafts-grid.jpg"
                  alt="Handgemaakte producten"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  Handgemaakt & benodigdheden
                </h3>
                <p className="mt-2 text-[var(--muted)]">
                  Vind unieke producten van makers en betrouwbare leveranciers.
                </p>
                <Link
                  href="/crochet"
                  className="mt-4 inline-block text-[var(--accent)] font-medium hover:underline"
                >
                  Verken producten →
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]">
              <div className="aspect-[4/3] relative">
                <Image
                  src="/landing/workshop.jpg"
                  alt="Workshop"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  Workshops & events
                </h3>
                <p className="mt-2 text-[var(--muted)]">
                  Leer van experts en ontmoet andere hobbyisten.
                </p>
                <Link
                  href="/workshops"
                  className="mt-4 inline-block text-[var(--accent)] font-medium hover:underline"
                >
                  Bekijk agenda →
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]">
              <div className="aspect-[4/3] relative">
                <Image
                  src="/landing/community.jpg"
                  alt="Community"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  Community
                </h3>
                <p className="mt-2 text-[var(--muted)]">
                  Ontdek creators, volg favorieten en deel je projecten.
                </p>
                <Link
                  href="/creators"
                  className="mt-4 inline-block text-[var(--accent)] font-medium hover:underline"
                >
                  Ontdek makers →
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)] bg-[var(--card)] py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">
              Start vandaag
            </h2>
            <p className="mt-4 text-lg text-[var(--muted)]">
              Verken domeinen, volg makers en ontdek je volgende hobby.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/">Ga naar Hobbysalon</Link>
            </Button>
          </div>
        </Container>
      </section>
    </div>
  );
}
