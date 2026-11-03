import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowRight, Check, Gift } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { RevealOnView } from "./reveal-on-view";

/**
 * Shared layout for the voor-* audience pages: one primary action, three
 * steps, what you get, what it costs, why here, FAQ, closing.
 */
export type AudienceLandingConfig = {
  eyebrow: string;
  /** Headline lines; each line is a meaningful break. */
  headline: readonly string[];
  subheadline: string;
  cta: { label: string; href: string };
  heroImage: string;
  proof: readonly string[];
  steps: { title: string; items: readonly { title: string; body: string }[] };
  /** Image cards, for example handmade and destash. */
  showcase?: {
    title: string;
    items: readonly { title: string; body: string; image: string; alt: string }[];
    note?: string;
  };
  /** Plain cards without images, for example features. */
  features?: { title: string; body?: string; items: readonly { title: string; body: string }[] };
  /** A list with a photo, for example what a listing shows. */
  checklist?: { title: string; items: readonly string[]; note?: string; image: string; alt: string };
  /** An important warning, shown as its own block. */
  warning?: { title: string; body: string };
  offer: {
    title: string;
    free: { label: string; title: string; items: readonly string[]; giftIndex?: number; note?: string };
    paid?: {
      label: string;
      title: string;
      items: readonly string[];
      note?: string;
      link?: { label: string; href: string };
    };
    highlight?: string;
  };
  why: { title: string; image: string; alt: string; items: readonly { title: string; body: string }[] };
  faq: readonly { question: string; answer: string }[];
  closing: { title: string; body: string };
};

const H2 =
  "font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] [text-wrap:balance] md:text-4xl";
const CARD = "rounded-2xl border border-[var(--border)] bg-[var(--card)]";

function PrimaryCta({ cta, onDark = false }: { cta: AudienceLandingConfig["cta"]; onDark?: boolean }) {
  return (
    <Button
      asChild
      size="lg"
      className={`min-h-12 px-6 text-lg active:scale-[0.98] bg-[var(--accent)] hover:bg-[var(--accent-hover)] ${
        onDark ? "text-white" : "text-[var(--accent-foreground)]"
      }`}
    >
      <Link href={cta.href}>
        {cta.label}
        <ArrowRight size={20} aria-hidden />
      </Link>
    </Button>
  );
}

function AudienceLanding({ config: c }: { config: AudienceLandingConfig }) {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      {/* 1. Hero */}
      <section className="relative isolate overflow-hidden bg-[var(--foreground)]">
        <div className="absolute inset-0" aria-hidden>
          <Image src={c.heroImage} alt="" fill priority sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-[var(--foreground)]/65 md:bg-transparent md:bg-gradient-to-r md:from-[var(--foreground)]/90 md:via-[var(--foreground)]/60 md:to-[var(--foreground)]/10" />
        </div>
        <Container className="relative flex min-h-[600px] flex-col justify-end pb-16 pt-24 md:min-h-[min(84dvh,680px)] md:justify-center md:pb-24">
          <p className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-white">
            {c.eyebrow}
          </p>
          <h1 className="mt-4 max-w-[680px] font-[family-name:var(--font-heading)] text-4xl font-bold leading-tight tracking-[-0.035em] text-white [text-wrap:balance] md:text-6xl">
            {c.headline.map((line, index) => (
              <span key={line}>
                {index > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-[680px] text-lg leading-relaxed text-white/90 [text-wrap:pretty] md:text-xl">
            {c.subheadline}
          </p>
          <div className="mt-10">
            <PrimaryCta cta={c.cta} onDark />
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/25 pt-6">
            {c.proof.map((item) => (
              <li key={item} className="flex items-center gap-2 text-lg font-semibold text-white">
                <Check size={20} aria-hidden className="text-[var(--accent)]" />
                {item}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 2. Steps */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{c.steps.title}</h2>
          </RevealOnView>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {c.steps.items.map((step, index) => (
              <li key={step.title} className={`${CARD} p-8`}>
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

      {/* 3. What you get */}
      {c.showcase ? (
        <section className="bg-[var(--section-alt)]">
          <Container className="py-16 md:py-24">
            <RevealOnView>
              <h2 className={H2}>{c.showcase.title}</h2>
            </RevealOnView>
            <ul className={`mt-10 grid gap-6 ${c.showcase.items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {c.showcase.items.map((item) => (
                <li key={item.title} className={`${CARD} overflow-hidden`}>
                  <div className="relative aspect-[16/9]">
                    <Image src={item.image} alt={item.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
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
            {c.showcase.note ? (
              <p className={`${CARD} mt-8 max-w-[70ch] p-6 text-lg leading-relaxed text-[var(--foreground)]`}>
                {c.showcase.note}
              </p>
            ) : null}
          </Container>
        </section>
      ) : null}

      {c.checklist ? (
        <section className="bg-[var(--section-alt)]">
          <Container className="py-16 md:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <RevealOnView>
                <h2 className={H2}>{c.checklist.title}</h2>
                <ul className="mt-8 space-y-4">
                  {c.checklist.items.map((item) => (
                    <li key={item} className="flex gap-3 text-lg leading-relaxed text-[var(--foreground)]">
                      <Check size={24} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent-hover)]" />
                      {item}
                    </li>
                  ))}
                </ul>
                {c.checklist.note ? <p className="mt-6 text-lg text-[var(--muted)]">{c.checklist.note}</p> : null}
              </RevealOnView>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image src={c.checklist.image} alt={c.checklist.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
              </div>
            </div>
            {c.warning ? (
              <div className="mt-10 flex gap-4 rounded-2xl border-2 border-[var(--accent)]/50 bg-[var(--card)] p-6">
                <AlertTriangle size={28} aria-hidden className="shrink-0 text-[var(--accent-hover)]" />
                <div>
                  <h3 className="text-xl font-bold text-[var(--foreground)]">{c.warning.title}</h3>
                  <p className="mt-2 text-lg leading-relaxed text-[var(--muted)]">{c.warning.body}</p>
                </div>
              </div>
            ) : null}
          </Container>
        </section>
      ) : null}

      {c.features ? (
        <section className={c.showcase || c.checklist ? "" : "bg-[var(--section-alt)]"}>
          <Container className="py-16 md:py-24">
            <RevealOnView>
              <h2 className={H2}>{c.features.title}</h2>
              {c.features.body ? (
                <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-[var(--muted)] md:text-xl">{c.features.body}</p>
              ) : null}
            </RevealOnView>
            <ul className="mt-10 grid gap-6 md:grid-cols-2">
              {c.features.items.map((item) => (
                <li key={item.title} className={`${CARD} p-6 md:p-8`}>
                  <h3 className="text-xl font-bold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-2 text-lg leading-relaxed text-[var(--muted)]">{item.body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* 4. What it costs */}
      <section aria-labelledby="kosten-titel">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 id="kosten-titel" className={H2}>
              {c.offer.title}
            </h2>
          </RevealOnView>
          <div className={`mt-10 grid gap-6 ${c.offer.paid ? "lg:grid-cols-2" : ""}`}>
            <div className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--section-highlight)] p-8">
              <p className="text-base font-semibold uppercase tracking-wide text-[var(--accent-hover)]">{c.offer.free.label}</p>
              <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
                {c.offer.free.title}
              </h3>
              <ul className="mt-6 space-y-4">
                {c.offer.free.items.map((item, index) => {
                  const Icon = index === c.offer.free.giftIndex ? Gift : Check;
                  return (
                    <li key={item} className="flex gap-3 text-lg text-[var(--foreground)]">
                      <Icon size={24} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent-hover)]" />
                      {item}
                    </li>
                  );
                })}
              </ul>
              {c.offer.free.note ? <p className="mt-6 text-base text-[var(--muted)]">{c.offer.free.note}</p> : null}
              <div className="mt-8">
                <PrimaryCta cta={c.cta} />
              </div>
            </div>
            {c.offer.paid ? (
              <div className={`${CARD} p-8`}>
                <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">{c.offer.paid.label}</p>
                <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
                  {c.offer.paid.title}
                </h3>
                <ul className="mt-6 space-y-4">
                  {c.offer.paid.items.map((item) => (
                    <li key={item} className="flex gap-3 text-lg text-[var(--foreground)]">
                      <Check size={24} aria-hidden className="mt-0.5 shrink-0 text-[var(--muted)]" />
                      {item}
                    </li>
                  ))}
                </ul>
                {c.offer.paid.note ? <p className="mt-6 text-base text-[var(--muted)]">{c.offer.paid.note}</p> : null}
                {c.offer.paid.link ? (
                  <Link
                    href={c.offer.paid.link.href}
                    className="mt-4 inline-flex min-h-12 items-center gap-2 text-lg font-semibold text-[var(--accent-hover)] underline-offset-4 hover:underline"
                  >
                    {c.offer.paid.link.label}
                    <ArrowRight size={18} aria-hidden />
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          {c.offer.highlight ? (
            <p className="mt-8 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] [text-wrap:balance]">
              {c.offer.highlight}
            </p>
          ) : null}
        </Container>
      </section>

      {/* 5. Why here */}
      <section className="bg-[var(--section-highlight)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{c.why.title}</h2>
          </RevealOnView>
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <figure className="relative min-h-72 overflow-hidden rounded-2xl">
              <Image src={c.why.image} alt={c.why.alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
            </figure>
            <ul className="grid gap-4">
              {c.why.items.map((item) => (
                <li key={item.title} className={`${CARD} p-6`}>
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
            <h2 className={H2}>Veelgestelde vragen</h2>
          </RevealOnView>
          <div className="mt-10 space-y-3">
            {c.faq.map((item) => (
              <details key={item.question} className="group border-b border-[var(--border-strong)]/50">
                <summary className="cursor-pointer list-none py-5 text-lg font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
                  <span className="flex min-h-12 items-center justify-between gap-4">
                    {item.question}
                    <span className="shrink-0 text-2xl font-light text-[var(--accent)] transition-transform group-open:rotate-45" aria-hidden>
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
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-white [text-wrap:balance] md:text-4xl">
              {c.closing.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[48ch] text-lg leading-relaxed text-white/80">{c.closing.body}</p>
            <div className="mt-9 flex justify-center">
              <PrimaryCta cta={c.cta} onDark />
            </div>
          </RevealOnView>
        </Container>
      </section>
    </div>
  );
}

export { AudienceLanding };
