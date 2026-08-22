import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { ORGANIZER_PAGE } from "@/lib/pricing/public-pricing";
import { RevealOnView } from "./reveal-on-view";
import { AboutHobbysalonSection } from "./about-hobbysalon-section";

const copy = ORGANIZER_PAGE;

function OrganizerLanding() {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      {/* Hero */}
      <section className="relative isolate min-h-[100dvh] overflow-hidden bg-[var(--foreground)] md:min-h-0">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={LANDING_IMAGES.placeholderEvent}
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
          <h1 className="mt-4 max-w-[14ch] font-[family-name:var(--font-heading)] text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-white md:text-5xl lg:text-6xl">
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

      {/* Free listing fields */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="max-w-[18ch] font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.freeListing.title}
            </h2>
          </RevealOnView>

          <RevealOnView>
            <ul className="mt-10 grid gap-0 border-t border-[var(--border-strong)]/45 md:mt-12">
              {copy.freeListing.items.map((item, index) => (
                <li
                  key={item}
                  className="grid grid-cols-[auto_1fr] gap-5 border-b border-[var(--border-strong)]/45 py-5 md:gap-8 md:py-6"
                >
                  <span
                    className="font-[family-name:var(--font-heading)] text-xl font-bold tabular-nums text-[var(--accent)] md:text-2xl"
                    aria-hidden
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="pt-0.5 text-base leading-relaxed text-[var(--foreground)] md:text-lg">
                    {item}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-8 max-w-[55ch] text-base font-medium leading-relaxed text-[var(--foreground)] md:text-lg">
              {copy.freeListing.note}
            </p>
          </RevealOnView>
        </Container>
      </section>

      {/* Event page features */}
      <section className="bg-[var(--section-alt)]">
        <Container className="py-16 md:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
            <RevealOnView className="lg:col-span-5">
              <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
                {copy.eventPage.title}
              </h2>
              <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {copy.eventPage.intro}
              </p>
              <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[var(--radius)] bg-[var(--card)] lg:mt-10">
                <Image
                  src={LANDING_IMAGES.community}
                  alt="Bezoekers op een creatieve beurs"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
            </RevealOnView>

            <RevealOnView className="lg:col-span-7" delayMs={60}>
              <ul className="divide-y divide-[var(--border-strong)]/40 border-t border-b border-[var(--border-strong)]/40">
                {copy.eventPage.items.map((item) => (
                  <li
                    key={item}
                    className="py-4 text-base leading-relaxed text-[var(--foreground)] md:py-5 md:text-lg"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </RevealOnView>
          </div>
        </Container>
      </section>

      {/* Exhibitors */}
      <section>
        <Container className="py-16 md:py-20">
          <RevealOnView>
            <div className="max-w-3xl border-l-4 border-[var(--accent)] pl-6 md:pl-8">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                {copy.exhibitors.title}
              </h2>
              <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {copy.exhibitors.body}
              </p>
            </div>
          </RevealOnView>
        </Container>
      </section>

      {/* Audience */}
      <section className="bg-[var(--section-highlight)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="relative aspect-[16/11] overflow-hidden rounded-[var(--radius)] bg-[var(--section-alt)] lg:col-span-5">
                <Image
                  src={LANDING_IMAGES.domainDiy}
                  alt="Creatieve community op een hobbybeurs"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div className="lg:col-span-7">
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                  {copy.audience.title}
                </h2>
                <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {copy.audience.body}
                </p>
              </div>
            </div>
          </RevealOnView>
        </Container>
      </section>

      {/* Pilot pricing */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.pricing.title}
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 md:gap-8">
              {copy.pricing.items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[var(--radius)] border border-[var(--border-strong)]/50 bg-[var(--card)] px-6 py-8 md:px-8"
                >
                  <p className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] md:text-2xl">
                    {item.label}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-[var(--accent)] md:text-xl">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-[60ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
              {copy.pricing.note}
            </p>
          </RevealOnView>
        </Container>
      </section>

      {/* Doubt + CTA */}
      <section className="bg-[var(--foreground)]">
        <Container className="py-16 text-center md:py-20">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-white md:text-3xl">
              {copy.doubt.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-base leading-relaxed text-white/75 md:text-lg">
              {copy.doubt.body}
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

      <AboutHobbysalonSection />
    </div>
  );
}

export { OrganizerLanding };
