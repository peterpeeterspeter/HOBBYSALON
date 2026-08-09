import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { CONTENT_PAGE } from "@/lib/pricing/public-pricing";
import { RevealOnView } from "./reveal-on-view";
import { AboutHobbysalonSection } from "./about-hobbysalon-section";

const copy = CONTENT_PAGE;

function ContentMakerLanding() {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      {/* Hero */}
      <section className="relative isolate min-h-[100dvh] overflow-hidden bg-[var(--foreground)] md:min-h-0">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={LANDING_IMAGES.placeholderArticle}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/92 via-[var(--foreground)]/58 to-[var(--foreground)]/28 md:bg-gradient-to-r md:from-[var(--foreground)]/90 md:via-[var(--foreground)]/55 md:to-[var(--foreground)]/22" />
        </div>

        <Container className="relative flex min-h-[100dvh] flex-col justify-end pb-16 pt-20 md:min-h-[min(92dvh,760px)] md:justify-center md:pb-24 md:pt-20">
          <p className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">
            Hobbysalon
          </p>
          <h1 className="mt-4 max-w-[18ch] font-[family-name:var(--font-heading)] text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-white md:text-5xl lg:text-[3.25rem]">
            {copy.headline}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90 md:text-xl">
            {copy.heroSubheadline}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="min-h-12 bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
            >
              <Link href={copy.primaryCta.href}>{copy.primaryCta.label}</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="min-h-12 border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              <Link href={copy.secondaryCta.href}>{copy.secondaryCta.label}</Link>
            </Button>
          </div>
        </Container>
      </section>

      {/* Intro */}
      <section className="border-b border-[var(--border)]">
        <Container className="py-12 md:py-16">
          <RevealOnView>
            <p className="max-w-[58ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl">
              {copy.intro}
            </p>
          </RevealOnView>
        </Container>
      </section>

      {/* What you publish + photo */}
      <section>
        <Container className="py-16 md:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            <RevealOnView className="lg:col-span-6 lg:order-2">
              <div className="relative aspect-[5/4] overflow-hidden rounded-[var(--radius)] bg-[var(--section-alt)]">
                <Image
                  src={LANDING_IMAGES.domainKnitting}
                  alt="Hobbyist die een tutorial of patroon volgt"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
              </div>
            </RevealOnView>
            <RevealOnView className="lg:col-span-6 lg:order-1">
              <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
                {copy.publish.title}
              </h2>
              <p className="mt-5 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {copy.publish.body}
              </p>
            </RevealOnView>
          </div>
        </Container>
      </section>

      {/* Material linking */}
      <section className="bg-[var(--section-alt)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="max-w-[20ch] font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.materials.title}
            </h2>
            <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
              {copy.materials.body}
            </p>
            <p className="mt-5 max-w-[60ch] border-l-4 border-[var(--accent)] pl-5 text-base font-medium leading-relaxed text-[var(--foreground)] md:pl-6 md:text-lg">
              {copy.materials.note}
            </p>
          </RevealOnView>
        </Container>
      </section>

      {/* Why publish here */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.why.title}
            </h2>
          </RevealOnView>

          <RevealOnView className="mt-12 md:mt-16">
            <div className="max-w-3xl border-l-4 border-[var(--accent)] pl-6 md:pl-8">
              <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold leading-snug text-[var(--foreground)] md:text-3xl">
                {copy.why.items[0].title}
              </h3>
              <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {copy.why.items[0].body}
              </p>
            </div>
          </RevealOnView>

          <RevealOnView className="mt-14 md:mt-20">
            <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="relative aspect-[16/11] overflow-hidden rounded-[var(--radius)] bg-[var(--section-alt)] lg:col-span-5">
                <Image
                  src={LANDING_IMAGES.craftsGrid}
                  alt="Creatieve materialen en patronen"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div className="lg:col-span-7">
                <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                  {copy.why.items[1].title}
                </h3>
                <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {copy.why.items[1].body}
                </p>
              </div>
            </div>
          </RevealOnView>

          <RevealOnView className="mt-14 md:mt-16">
            <div className="rounded-[var(--radius)] border border-[var(--border-strong)]/50 bg-[var(--card)] px-6 py-8 md:px-10 md:py-10">
              <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                {copy.why.items[2].title}
              </h3>
              <p className="mt-3 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {copy.why.items[2].body}
              </p>
            </div>
          </RevealOnView>
        </Container>
      </section>

      {/* Coming soon */}
      <section className="bg-[var(--section-highlight)]">
        <Container className="py-14 md:py-16">
          <RevealOnView>
            <div className="flex gap-5 rounded-[var(--radius)] border border-[var(--accent)]/30 bg-[var(--card)] p-6 md:gap-6 md:p-8">
              <Sparkles
                className="mt-0.5 size-7 shrink-0 text-[var(--accent)] md:size-8"
                strokeWidth={1.75}
                aria-hidden
              />
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] md:text-2xl">
                  {copy.comingSoon.title}
                </h2>
                <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {copy.comingSoon.body}
                </p>
                <p className="mt-4 max-w-[65ch] text-base font-medium leading-relaxed text-[var(--foreground)] md:text-lg">
                  {copy.comingSoon.note}
                </p>
              </div>
            </div>
          </RevealOnView>
        </Container>
      </section>

      {/* Pricing + CTA */}
      <section className="bg-[var(--foreground)]">
        <Container className="py-16 text-center md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-white md:text-3xl">
              {copy.pricing.title}
            </h2>
            <p className="mt-4 font-[family-name:var(--font-heading)] text-5xl font-bold tracking-[-0.04em] text-white md:text-6xl">
              Gratis
            </p>
            <p className="mx-auto mt-5 max-w-[48ch] text-base leading-relaxed text-white/75 md:text-lg">
              {copy.pricing.body}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={copy.primaryCta.href}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
              >
                {copy.primaryCta.label}
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link
                href={copy.secondaryCta.href}
                className="inline-flex min-h-12 items-center rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white/95 transition-colors hover:bg-white/20"
              >
                {copy.secondaryCta.label}
              </Link>
            </div>
          </RevealOnView>
        </Container>
      </section>

      <AboutHobbysalonSection />
    </div>
  );
}

export { ContentMakerLanding };
