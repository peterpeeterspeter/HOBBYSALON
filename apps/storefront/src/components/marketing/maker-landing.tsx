import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Gift } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { MAKERS_PAGE } from "@/lib/pricing/public-pricing";
import { RevealOnView } from "./reveal-on-view";

const copy = MAKERS_PAGE;

const H2 =
  "font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] [text-wrap:balance] md:text-4xl";
const LEAD = "mt-4 max-w-[60ch] text-lg leading-relaxed text-[var(--muted)] [text-wrap:pretty] md:text-xl";

const AD_TYPE_IMAGES = [
  { src: LANDING_IMAGES.craftsGrid, alt: "Handgemaakte creaties op tafel" },
  { src: LANDING_IMAGES.domainSewing, alt: "Stof en naaimateriaal uit eigen voorraad" },
] as const;

function PrimaryCta({ onDark = false }: { onDark?: boolean }) {
  return (
    <Button
      asChild
      size="lg"
      className={`min-h-12 px-6 text-lg active:scale-[0.98] ${
        onDark
          ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
          : "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
      }`}
    >
      <Link href={copy.primaryCta.href}>
        {copy.primaryCta.label}
        <ArrowRight size={20} aria-hidden />
      </Link>
    </Button>
  );
}

function MakerLanding() {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      {/* 1. Hero: one action */}
      <section className="relative isolate overflow-hidden bg-[var(--foreground)]">
        <div className="absolute inset-0" aria-hidden>
          <Image src={LANDING_IMAGES.domainPottery} alt="" fill priority sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-[var(--foreground)]/65 md:bg-transparent md:bg-gradient-to-r md:from-[var(--foreground)]/90 md:via-[var(--foreground)]/60 md:to-[var(--foreground)]/10" />
        </div>
        <Container className="relative flex min-h-[600px] flex-col justify-end pb-16 pt-24 md:min-h-[min(84dvh,680px)] md:justify-center md:pb-24">
          <p className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-white">
            Hobbysalon voor makers
          </p>
          <h1 className="mt-4 max-w-[680px] font-[family-name:var(--font-heading)] text-4xl font-bold leading-tight tracking-[-0.035em] text-white [text-wrap:balance] md:text-6xl">
            Verkoop je handmade werk.
            <br />
            Zonder commissie.
          </h1>
          <p className="mt-6 max-w-[680px] text-lg leading-relaxed text-white/90 [text-wrap:pretty] md:text-xl">
            {copy.heroSubheadline}
          </p>
          <div className="mt-10">
            <PrimaryCta onDark />
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/25 pt-6">
            {copy.heroProof.map((item) => (
              <li key={item} className="flex items-center gap-2 text-lg font-semibold text-white">
                <Check size={20} aria-hidden className="text-[var(--accent)]" />
                {item}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 2. Three steps */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{copy.steps.title}</h2>
          </RevealOnView>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {copy.steps.items.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
                <span className="flex size-12 items-center justify-center rounded-full bg-[var(--section-highlight)] font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--accent-hover)]">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-xl font-bold text-[var(--foreground)]">{step.title}</h3>
                <p className="mt-2 text-lg leading-relaxed text-[var(--muted)]">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* 3. What you can sell */}
      <section className="bg-[var(--section-alt)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{copy.adTypes.title}</h2>
          </RevealOnView>
          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            {copy.adTypes.items.map((item, index) => (
              <li key={item.title} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                <div className="relative aspect-[16/9]">
                  <Image
                    src={AD_TYPE_IMAGES[index].src}
                    alt={AD_TYPE_IMAGES[index].alt}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-6 md:p-8">
                  <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-lg leading-relaxed text-[var(--muted)]">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-[70ch] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-lg leading-relaxed text-[var(--foreground)]">
            {copy.adTypes.note}
          </p>
        </Container>
      </section>

      {/* 4. The offer: free first, then credits */}
      <section aria-labelledby="kosten-titel">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 id="kosten-titel" className={H2}>
              {copy.offer.title}
            </h2>
          </RevealOnView>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--section-highlight)] p-8">
              <p className="text-base font-semibold uppercase tracking-wide text-[var(--accent-hover)]">
                {copy.offer.free.label}
              </p>
              <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
                {copy.offer.free.title}
              </h3>
              <ul className="mt-6 space-y-4">
                {copy.offer.free.items.map((item, index) => (
                  <li key={item} className="flex gap-3 text-lg text-[var(--foreground)]">
                    {index === 2 ? (
                      <Gift size={24} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent-hover)]" />
                    ) : (
                      <Check size={24} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent-hover)]" />
                    )}
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <PrimaryCta />
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
              <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">
                {copy.offer.paid.label}
              </p>
              <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
                {copy.offer.paid.title}
              </h3>
              <ul className="mt-6 space-y-4">
                {copy.offer.paid.items.map((item) => (
                  <li key={item} className="flex gap-3 text-lg text-[var(--foreground)]">
                    <Check size={24} aria-hidden className="mt-0.5 shrink-0 text-[var(--muted)]" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-base text-[var(--muted)]">{copy.offer.paid.note}</p>
              <Link
                href={copy.offer.pricesLink.href}
                className="mt-4 inline-flex min-h-12 items-center gap-2 text-lg font-semibold text-[var(--accent-hover)] underline-offset-4 hover:underline"
              >
                {copy.offer.pricesLink.label}
                <ArrowRight size={18} aria-hidden />
              </Link>
            </div>
          </div>
          <p className="mt-8 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
            {copy.offer.commission}
          </p>
        </Container>
      </section>

      {/* 5. Why here */}
      <section className="bg-[var(--section-highlight)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{copy.why.title}</h2>
          </RevealOnView>
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <figure className="relative min-h-72 overflow-hidden rounded-2xl">
              <Image
                src={LANDING_IMAGES.community}
                alt="Bezoekers en makers op een makersmarkt"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </figure>
            <ul className="grid gap-4">
              {copy.why.items.map((item) => (
                <li key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
                  <h3 className="text-xl font-bold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-2 text-lg leading-relaxed text-[var(--muted)]">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* 6. FAQ */}
      <section>
        <Container size="narrow" className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{copy.faqTitle}</h2>
          </RevealOnView>
          <div className="mt-10 space-y-3">
            {copy.faq.map((item) => (
              <details key={item.question} className="group border-b border-[var(--border-strong)]/50">
                <summary className="cursor-pointer list-none py-5 text-lg font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
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
                <p className="pb-5 text-lg leading-relaxed text-[var(--muted)]">{item.answer}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* 7. Closing: same action as the hero */}
      <section className="bg-[var(--foreground)]">
        <Container className="py-16 text-center md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-white md:text-4xl">
              {copy.closing.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[48ch] text-lg leading-relaxed text-white/80">{copy.closing.body}</p>
            <div className="mt-9 flex justify-center">
              <PrimaryCta onDark />
            </div>
          </RevealOnView>
        </Container>
      </section>
    </div>
  );
}

export { MakerLanding };
