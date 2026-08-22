import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { ABOUT_PAGE } from "@/lib/marketing/about-page";
import { RevealOnView } from "./reveal-on-view";

const copy = ABOUT_PAGE;

function AboutLanding() {
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

      {/* Origin story */}
      <section className="border-b border-[var(--border)]">
        <Container className="py-16 md:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
            <RevealOnView className="lg:col-span-7">
              <div className="space-y-5">
                {copy.origin.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 48)}
                    className="max-w-[58ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </RevealOnView>
            <RevealOnView className="lg:col-span-5" delayMs={80}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius)] bg-[var(--section-alt)]">
                <Image
                  src={LANDING_IMAGES.craftsGrid}
                  alt="Creatieve materialen en beursfeer"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
            </RevealOnView>
          </div>
        </Container>
      </section>

      {/* Beliefs */}
      <section className="bg-[var(--section-alt)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.beliefs.title}
            </h2>
          </RevealOnView>

          <div className="mt-12 space-y-0 border-t border-[var(--border-strong)]/45 md:mt-14">
            {copy.beliefs.items.map((item, index) => (
              <RevealOnView key={item.title}>
                <div className="grid gap-3 border-b border-[var(--border-strong)]/45 py-8 md:grid-cols-12 md:gap-8 md:py-10">
                  <span
                    className="font-[family-name:var(--font-heading)] text-2xl font-bold tabular-nums text-[var(--accent)] md:col-span-1 md:text-3xl"
                    aria-hidden
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="md:col-span-11">
                    <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] md:text-2xl">
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-[58ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                      {item.body}
                    </p>
                  </div>
                </div>
              </RevealOnView>
            ))}
          </div>
        </Container>
      </section>

      {/* Audiences */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.audiences.title}
            </h2>
          </RevealOnView>

          <div className="mt-12 space-y-14 md:mt-16 md:space-y-20">
            <RevealOnView>
              <div className="max-w-3xl border-l-4 border-[var(--accent)] pl-6 md:pl-8">
                <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                  {copy.audiences.hobbyist.title}
                </h3>
                <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {copy.audiences.hobbyist.body}
                </p>
                <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                  {copy.audiences.hobbyist.note}
                </p>
                <Link
                  href={copy.audiences.hobbyist.cta.href}
                  className="mt-6 inline-flex min-h-12 items-center gap-2 text-base font-semibold text-[var(--accent)] underline-offset-4 hover:underline md:text-lg"
                >
                  {copy.audiences.hobbyist.cta.label}
                  <ArrowRight size={18} aria-hidden />
                </Link>
              </div>
            </RevealOnView>

            <RevealOnView>
              <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
                <div className="relative aspect-[16/11] overflow-hidden rounded-[var(--radius)] bg-[var(--section-alt)] lg:col-span-5">
                  <Image
                    src={LANDING_IMAGES.workshop}
                    alt="Workshopgever en hobbyisten aan het werk"
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
                <div className="lg:col-span-7">
                  <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                    {copy.audiences.providers.title}
                  </h3>
                  <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                    {copy.audiences.providers.body}
                  </p>
                  <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                    {copy.audiences.providers.note}
                  </p>
                  <Link
                    href={copy.audiences.providers.cta.href}
                    className="mt-6 inline-flex min-h-12 items-center gap-2 text-base font-semibold text-[var(--accent)] underline-offset-4 hover:underline md:text-lg"
                  >
                    {copy.audiences.providers.cta.label}
                    <ArrowRight size={18} aria-hidden />
                  </Link>
                </div>
              </div>
            </RevealOnView>
          </div>
        </Container>
      </section>

      {/* Connected graph */}
      <section className="bg-[var(--section-highlight)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className="max-w-[18ch] font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.connected.title}
            </h2>
            <p className="mt-5 max-w-[55ch] text-base font-medium leading-relaxed text-[var(--foreground)] md:text-lg">
              {copy.connected.intro}
            </p>
            <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
              {copy.connected.body}
            </p>
            <ul className="mt-8 max-w-[60ch] space-y-3">
              {copy.connected.forWhom.map((line) => (
                <li
                  key={line}
                  className="border-l-4 border-[var(--accent)] pl-5 text-base leading-relaxed text-[var(--foreground)] md:text-lg"
                >
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-8 max-w-[60ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
              {copy.connected.closing}
            </p>
          </RevealOnView>
        </Container>
      </section>

      {/* Roadmap */}
      <section>
        <Container className="py-16 md:py-20">
          <RevealOnView>
            <div className="rounded-[var(--radius)] border border-[var(--border-strong)]/50 bg-[var(--card)] px-6 py-8 md:px-10 md:py-10">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] md:text-3xl">
                {copy.roadmap.title}
              </h2>
              <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
                {copy.roadmap.body}
              </p>
              <p className="mt-4 max-w-[60ch] text-base font-medium leading-relaxed text-[var(--foreground)] md:text-lg">
                {copy.roadmap.note}
              </p>
            </div>
          </RevealOnView>
        </Container>
      </section>

      {/* Team / contact */}
      <section id="contact" className="scroll-mt-28 bg-[var(--section-alt)]">
        <Container className="py-16 md:py-20">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl">
              {copy.team.title}
            </h2>
            <p className="mt-5 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
              {copy.team.body}
            </p>
            <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[var(--muted)] md:text-lg">
              {copy.team.invite}
            </p>
            <a
              href={copy.team.contactCta.href}
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
            >
              {copy.team.contactCta.label}
              <ArrowRight size={18} aria-hidden />
            </a>
            <p className="mt-3 text-base text-[var(--muted)]">
              <a
                href="mailto:info@hobbysalon.be"
                className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
              >
                info@hobbysalon.be
              </a>
            </p>
          </RevealOnView>
        </Container>
      </section>

      {/* Closing */}
      <section className="bg-[var(--foreground)]">
        <Container className="py-16 text-center md:py-20">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-white md:text-3xl">
              {copy.closing.title}
            </h2>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              {copy.closing.links.map((link, index) =>
                index === 0 ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                  >
                    {link.label}
                    <ArrowRight size={18} aria-hidden />
                  </Link>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex min-h-12 items-center rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white/95 transition-colors hover:bg-white/20"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>
          </RevealOnView>
        </Container>
      </section>
    </div>
  );
}

export { AboutLanding };
