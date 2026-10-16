import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { ADVERTEREN_PAGE } from "@/lib/marketing/adverteren-page";
import { RevealOnView } from "./reveal-on-view";

const copy = ADVERTEREN_PAGE;

function AdverterenLanding() {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      {/* Hero — brand first, one job */}
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
              <a href={copy.primaryCta.href}>{copy.primaryCta.label}</a>
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

      {/* Audience */}
      <section className="border-b border-[var(--border)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.audienceTitle}
            </h2>
            <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl">
              {copy.audienceIntro}
            </p>
          </RevealOnView>

          <div className="mt-12 space-y-10 md:mt-14">
            {copy.audienceStats.map((stat) => (
              <RevealOnView key={stat.label}>
                <div className="border-l-4 border-[var(--accent)] pl-6 md:pl-8">
                  <p className="text-base font-semibold uppercase tracking-wide text-[var(--accent)] md:text-lg">
                    {stat.label}
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 max-w-[50ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl">
                    {stat.detail}
                  </p>
                </div>
              </RevealOnView>
            ))}
          </div>

          <RevealOnView className="mt-14 md:mt-16">
            <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
              {copy.hobbiesTitle}
            </h3>
            <ul className="mt-6 divide-y divide-[var(--border-strong)]/40 border-t border-b border-[var(--border-strong)]/40">
              {copy.hobbies.map((hobby) => (
                <li
                  key={hobby}
                  className="py-3.5 text-lg leading-relaxed text-[var(--foreground)] md:text-xl"
                >
                  {hobby}
                </li>
              ))}
            </ul>
          </RevealOnView>
        </Container>
      </section>

      {/* Tiers */}
      <section id="formules" className="scroll-mt-24 bg-[var(--section-alt)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.tiersTitle}
            </h2>
            <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl">
              {copy.tiersIntro}
            </p>
          </RevealOnView>

          <nav
            aria-label="Spring naar een formule"
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--border-strong)]/40 pb-8"
          >
            {copy.tiers.map((tier) => (
              <a
                key={tier.id}
                href={`#formule-${tier.id}`}
                className="min-h-11 text-base font-semibold text-[var(--accent)] underline-offset-4 hover:underline md:text-lg"
              >
                {tier.name}
              </a>
            ))}
          </nav>

          <ol className="mt-4">
            {copy.tiers.map((tier, index) => (
              <li
                key={tier.id}
                id={`formule-${tier.id}`}
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
                    <div className="lg:col-span-8">
                      <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                        {tier.name}
                      </h3>
                      <p className="mt-2 text-xl font-semibold text-[var(--accent)] md:text-2xl">
                        {tier.price}
                        <span className="ml-2 text-base font-medium text-[var(--muted)] md:text-lg">
                          {tier.priceNote}
                        </span>
                      </p>
                      <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl">
                        {tier.description}
                      </p>
                      <ul className="mt-5 divide-y divide-[var(--border-strong)]/40 border-t border-[var(--border-strong)]/40">
                        {tier.includes.map((item) => (
                          <li
                            key={item}
                            className="py-2.5 text-base leading-relaxed text-[var(--foreground)] md:text-lg"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-end lg:col-span-3 lg:justify-end">
                      <a
                        href={copy.primaryCta.href}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98] lg:w-auto"
                      >
                        Mail ons
                        <ArrowRight size={18} aria-hidden />
                      </a>
                    </div>
                  </div>
                </RevealOnView>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* 4-edition package */}
      <section>
        <Container className="py-16 md:py-20">
          <RevealOnView>
            <div className="max-w-3xl border-l-4 border-[var(--accent)] pl-6 md:pl-8">
              <p className="text-base font-semibold uppercase tracking-wide text-[var(--accent)] md:text-lg">
                {copy.packageHighlight}
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
                {copy.packageTitle}
              </h2>
              <p className="mt-4 max-w-[55ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl">
                {copy.packageBody}
              </p>
            </div>
          </RevealOnView>
        </Container>
      </section>

      {/* Conditions */}
      <section className="bg-[var(--section-highlight)]">
        <Container size="narrow" className="py-16 md:py-20">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.conditionsTitle}
            </h2>
            <ul className="mt-8 space-y-4">
              {copy.conditions.map((condition) => (
                <li
                  key={condition}
                  className="flex gap-3 text-lg leading-relaxed text-[var(--foreground)] md:text-xl"
                >
                  <span
                    className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                    aria-hidden
                  />
                  <span>{condition}</span>
                </li>
              ))}
            </ul>
          </RevealOnView>
        </Container>
      </section>

      {/* Closing CTA */}
      <section className="bg-[var(--foreground)]">
        <Container className="py-16 text-center md:py-20">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-white md:text-3xl">
              {copy.closingTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-lg leading-relaxed text-white/75 md:text-xl">
              {copy.closingDescription}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href={copy.primaryCta.href}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
              >
                {copy.primaryCta.label}
                <ArrowRight size={18} aria-hidden />
              </a>
            </div>
            <p className="mt-5 text-base text-white/70 md:text-lg">
              <a
                href={copy.primaryCta.href}
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                {copy.closingEmail}
              </a>
            </p>
          </RevealOnView>
        </Container>
      </section>
    </div>
  );
}

export { AdverterenLanding };
