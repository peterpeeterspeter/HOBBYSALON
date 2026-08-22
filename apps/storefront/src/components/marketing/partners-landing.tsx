import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { PARTNERS_PAGE } from "@/lib/marketing/partners-page";
import { RevealOnView } from "./reveal-on-view";

const copy = PARTNERS_PAGE;

function PartnersLanding() {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      {/* Hero */}
      <section className="relative isolate min-h-[100dvh] overflow-hidden bg-[var(--foreground)] md:min-h-0">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={LANDING_IMAGES.community}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/92 via-[var(--foreground)]/58 to-[var(--foreground)]/28 md:bg-gradient-to-r md:from-[var(--foreground)]/90 md:via-[var(--foreground)]/55 md:to-[var(--foreground)]/22" />
        </div>

        <Container className="relative flex min-h-[100dvh] flex-col justify-end pb-16 pt-20 md:min-h-[min(88dvh,720px)] md:justify-center md:pb-24 md:pt-20">
          <p className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">
            Hobbysalon
          </p>
          <h1 className="mt-4 max-w-[16ch] font-[family-name:var(--font-heading)] text-4xl font-bold leading-[1.1] tracking-[-0.035em] text-white md:text-5xl lg:text-6xl">
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

      {/* Connected intro */}
      <section className="border-b border-[var(--border)]">
        <Container className="py-12 md:py-16">
          <RevealOnView>
            <p className="max-w-[58ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl">
              {copy.intro}
            </p>
          </RevealOnView>
        </Container>
      </section>

      {/* Routes: stacked editorial rows, not equal cards */}
      <section id="routes" className="scroll-mt-24 bg-[var(--section-alt)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.routesTitle}
            </h2>
          </RevealOnView>

          {/* Jump links for long page (senior UX) */}
          <nav
            aria-label="Spring naar een route"
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--border-strong)]/40 pb-8"
          >
            {copy.routes.map((route) => (
              <a
                key={route.id}
                href={`#route-${route.id}`}
                className="min-h-11 text-base font-semibold text-[var(--accent)] underline-offset-4 hover:underline md:text-lg"
              >
                {route.role}
              </a>
            ))}
          </nav>

          <ol className="mt-4">
            {copy.routes.map((route, index) => (
              <li
                key={route.id}
                id={`route-${route.id}`}
                className="scroll-mt-28 border-b border-[var(--border-strong)]/45 py-10 last:border-b-0 md:py-12"
              >
                <RevealOnView>
                  <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
                    <div className="lg:col-span-1">
                      <span
                        className="font-[family-name:var(--font-heading)] text-2xl font-bold tabular-nums text-[var(--accent)] md:text-3xl"
                        aria-hidden
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="lg:col-span-7">
                      <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                        {route.role}
                      </h3>
                      <p className="mt-2 text-lg font-semibold text-[var(--accent)] md:text-xl">
                        {route.priceLabel}
                      </p>
                      <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                        {route.description}
                      </p>
                      <ul className="mt-5 divide-y divide-[var(--border-strong)]/40 border-t border-[var(--border-strong)]/40">
                        {route.features.map((feature) => (
                          <li
                            key={feature}
                            className="py-2.5 text-base leading-relaxed text-[var(--foreground)] md:text-lg"
                          >
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-end lg:col-span-4 lg:justify-end">
                      <Link
                        href={route.href}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98] lg:w-auto"
                      >
                        {route.ctaLabel}
                        <ArrowRight size={18} aria-hidden />
                      </Link>
                    </div>
                  </div>
                </RevealOnView>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Why: three distinct layouts, light theme */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.whyTitle}
            </h2>
          </RevealOnView>

          <RevealOnView className="mt-12 md:mt-16">
            <div className="max-w-3xl border-l-4 border-[var(--accent)] pl-6 md:pl-8">
              <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold leading-snug text-[var(--foreground)] md:text-3xl">
                {copy.why[0].title}
              </h3>
              <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {copy.why[0].body}
              </p>
            </div>
          </RevealOnView>

          <RevealOnView className="mt-14 md:mt-20">
            <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="relative aspect-[16/11] overflow-hidden rounded-[var(--radius)] bg-[var(--section-alt)] lg:col-span-5">
                <Image
                  src={LANDING_IMAGES.craftsGrid}
                  alt="Creatieve materialen en handwerk op Hobbysalon"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div className="lg:col-span-7">
                <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                  {copy.why[1].title}
                </h3>
                <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {copy.why[1].body}
                </p>
              </div>
            </div>
          </RevealOnView>

          <RevealOnView className="mt-14 md:mt-16">
            <div className="rounded-[var(--radius)] border border-[var(--border-strong)]/50 bg-[var(--card)] px-6 py-8 md:px-10 md:py-10">
              <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                {copy.why[2].title}
              </h3>
              <p className="mt-3 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {copy.why[2].body}
              </p>
            </div>
          </RevealOnView>
        </Container>
      </section>

      {/* FAQ */}
      <section className="bg-[var(--section-highlight)]">
        <Container size="narrow" className="py-16 md:py-20">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.faqTitle}
            </h2>
          </RevealOnView>
          <div className="mt-10 space-y-3">
            {copy.faq.map((item) => (
              <details
                key={item.question}
                className="group border-b border-[var(--border-strong)]/50 bg-transparent"
              >
                <summary className="cursor-pointer list-none py-5 text-base font-semibold text-[var(--foreground)] md:text-lg [&::-webkit-details-marker]:hidden">
                  <span className="flex min-h-12 items-center justify-between gap-4">
                    {item.question}
                    <span
                      className="shrink-0 text-2xl font-light text-[var(--accent)] transition-transform group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </span>
                </summary>
                <div className="pb-5 text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* Closing CTA */}
      <section className="bg-[var(--foreground)]">
        <Container className="py-16 text-center md:py-20">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-white md:text-3xl">
              {copy.closingTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-base leading-relaxed text-white/75 md:text-lg">
              {copy.closingDescription}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
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
    </div>
  );
}

export { PartnersLanding };
