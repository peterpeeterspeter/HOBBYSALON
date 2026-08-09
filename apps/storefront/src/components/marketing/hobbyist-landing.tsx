import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { HOBBYIST_PAGE } from "@/lib/marketing/hobbyist-page";
import { RevealOnView } from "./reveal-on-view";

const copy = HOBBYIST_PAGE;

function HobbyistLanding() {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      {/* Hero */}
      <section className="relative isolate min-h-[100dvh] overflow-hidden bg-[var(--foreground)] md:min-h-0">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={LANDING_IMAGES.hero}
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
          <h1 className="mt-4 max-w-[16ch] font-[family-name:var(--font-heading)] text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-white md:text-5xl lg:text-6xl">
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
            <p className="max-w-[60ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl">
              {copy.intro}
            </p>
          </RevealOnView>
        </Container>
      </section>

      {/* Pain recognition */}
      <section className="bg-[var(--section-alt)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.pain.title}
            </h2>
          </RevealOnView>
          <ul className="mt-10 max-w-3xl space-y-0 border-t border-[var(--border-strong)]/45 md:mt-12">
            {copy.pain.items.map((item) => (
              <li
                key={item}
                className="border-b border-[var(--border-strong)]/45 py-5 text-base leading-relaxed text-[var(--muted)] md:py-6 md:text-lg"
              >
                {item}
              </li>
            ))}
          </ul>
          <RevealOnView className="mt-8 md:mt-10">
            <p className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--accent)] md:text-3xl">
              {copy.pain.closer}
            </p>
          </RevealOnView>
        </Container>
      </section>

      {/* Discover everything */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.discover.title}
            </h2>
          </RevealOnView>

          <ul className="mt-10 border-t border-[var(--border-strong)]/45 md:mt-12">
            {copy.discover.items.map((item, index) => (
              <li
                key={item.title}
                className="border-b border-[var(--border-strong)]/45 py-8 md:py-9"
              >
                <RevealOnView>
                  <div className="grid gap-3 md:grid-cols-12 md:items-start md:gap-8">
                    <span
                      className="font-[family-name:var(--font-heading)] text-2xl font-bold tabular-nums text-[var(--accent)] md:col-span-1 md:text-3xl"
                      aria-hidden
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="md:col-span-8">
                      <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] md:text-2xl">
                        <Link
                          href={item.href}
                          className="underline-offset-4 hover:text-[var(--accent)] hover:underline"
                        >
                          {item.title}
                        </Link>
                      </h3>
                      <p className="mt-2 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                        {item.body}
                      </p>
                    </div>
                    <div className="md:col-span-3 md:flex md:justify-end md:pt-1">
                      <Link
                        href={item.href}
                        className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[var(--accent)] underline-offset-4 hover:underline md:text-lg"
                      >
                        Naar {item.title.toLowerCase()}
                        <ArrowRight size={16} aria-hidden />
                      </Link>
                    </div>
                  </div>
                </RevealOnView>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Connected */}
      <section className="bg-[var(--section-highlight)]">
        <Container className="py-16 md:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            <RevealOnView className="lg:col-span-6">
              <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
                {copy.connected.title}
              </h2>
              <p className="mt-5 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {copy.connected.body}
              </p>
              <p className="mt-5 max-w-[55ch] border-l-4 border-[var(--accent)] pl-5 text-base font-medium leading-relaxed text-[var(--foreground)] md:pl-6 md:text-lg">
                {copy.connected.note}
              </p>
            </RevealOnView>
            <RevealOnView className="lg:col-span-6" delayMs={80}>
              <div className="relative aspect-[5/4] overflow-hidden rounded-[var(--radius)] bg-[var(--section-alt)]">
                <Image
                  src={LANDING_IMAGES.craftsGrid}
                  alt="Creatieve materialen en projecten op Hobbysalon"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
              </div>
            </RevealOnView>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.howItWorks.title}
            </h2>
          </RevealOnView>

          <ol className="mt-12 space-y-10 md:mt-14 md:space-y-12">
            {copy.howItWorks.steps.map((step, index) => (
              <li key={step.title}>
                <RevealOnView>
                  <div className="grid gap-3 md:grid-cols-12 md:gap-8">
                    <span
                      className="font-[family-name:var(--font-heading)] text-4xl font-bold tabular-nums text-[var(--accent)] md:col-span-2 md:text-5xl"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <div className="md:col-span-9">
                      <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] md:text-2xl">
                        {step.title}
                      </h3>
                      <p className="mt-3 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </RevealOnView>
              </li>
            ))}
          </ol>

          <RevealOnView className="mt-12 md:mt-14">
            <Button asChild size="lg" className="min-h-12">
              <Link href={copy.howItWorks.cta.href}>
                {copy.howItWorks.cta.label}
                <ArrowRight size={18} aria-hidden />
              </Link>
            </Button>
          </RevealOnView>
        </Container>
      </section>

      {/* Why */}
      <section className="bg-[var(--section-alt)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.why.title}
            </h2>
          </RevealOnView>

          <div className="mt-12 space-y-10 md:mt-16 md:space-y-14">
            <RevealOnView>
              <div className="max-w-3xl border-l-4 border-[var(--accent)] pl-6 md:pl-8">
                <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                  {copy.why.items[0].title}
                </h3>
                <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {copy.why.items[0].body}
                </p>
              </div>
            </RevealOnView>

            <RevealOnView>
              <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
                <div className="relative aspect-[16/11] overflow-hidden rounded-[var(--radius)] bg-[var(--card)] lg:col-span-5">
                  <Image
                    src={LANDING_IMAGES.community}
                    alt="Hobbyisten die samen creatief bezig zijn"
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

            <RevealOnView>
              <div className="rounded-[var(--radius)] border border-[var(--border-strong)]/50 bg-[var(--card)] px-6 py-8 md:px-10 md:py-10">
                <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                  {copy.why.items[2].title}
                </h3>
                <p className="mt-3 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {copy.why.items[2].body}
                </p>
              </div>
            </RevealOnView>

            <RevealOnView>
              <div className="max-w-3xl">
                <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                  {copy.why.items[3].title}
                </h3>
                <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {copy.why.items[3].body}
                </p>
              </div>
            </RevealOnView>
          </div>
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
                className="group border-b border-[var(--border-strong)]/50"
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
                  {"contactHref" in item && item.contactHref ? (
                    <>
                      {" "}
                      <Link
                        href={item.contactHref}
                        className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                      >
                        Naar contact
                      </Link>
                      .
                    </>
                  ) : null}
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
              {copy.closing.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[48ch] text-base leading-relaxed text-white/75 md:text-lg">
              {copy.closing.body}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={copy.closing.primaryCta.href}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
              >
                {copy.closing.primaryCta.label}
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link
                href={copy.closing.secondaryCta.href}
                className="inline-flex min-h-12 items-center rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white/95 transition-colors hover:bg-white/20"
              >
                {copy.closing.secondaryCta.label}
              </Link>
            </div>
          </RevealOnView>
        </Container>
      </section>
    </div>
  );
}

export { HobbyistLanding };
