import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, CalendarDays, Calculator, Scissors, ShoppingBag, Store, Users } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import { HOBBYIST_PAGE } from "@/lib/marketing/hobbyist-page";
import type { HobbyistPageData } from "@/lib/services/hobbyist-page";
import type { ToolSummary } from "@/lib/tools/registry";
import { RevealOnView } from "./reveal-on-view";

const copy = HOBBYIST_PAGE;

const FEATURED_TOOL_SLUGS = [
  "garencalculator",
  "stofcalculator",
  "quiltcalculator",
  "naaldmaat-converter",
  "stekenproef-calculator",
  "kaarsen-wascalculator",
  "resin-calculator",
  "kralenarmband-calculator",
] as const;

const DISCOVER_ICONS: Record<string, typeof Scissors> = {
  "/workshops": Users,
  "/patronen": BookOpen,
  "/materials": ShoppingBag,
  "/creators": Store,
  "/agenda": CalendarDays,
};

/** Hobbies with a photo get a large tile; the rest a compact one. */
const PHOTO_TILES = 8;

const nl = new Intl.NumberFormat("nl-BE");

type HobbyistLandingProps = {
  tools: ToolSummary[];
  data: HobbyistPageData;
};

const H2 =
  "font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] [text-wrap:balance] md:text-4xl";
const LEAD = "mt-4 max-w-[60ch] text-lg leading-relaxed text-[var(--muted)] [text-wrap:pretty] md:text-xl";
const TEXT_LINK =
  "inline-flex min-h-12 items-center gap-2 text-lg font-semibold text-[var(--accent-hover)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 rounded";

function HobbyistLanding({ tools, data }: HobbyistLandingProps) {
  const featuredTools = FEATURED_TOOL_SLUGS.map((slug) => tools.find((tool) => tool.slug === slug)).filter(
    (tool): tool is ToolSummary => Boolean(tool),
  );
  const withPhoto = data.hobbies.filter((hobby) => hobby.image).slice(0, PHOTO_TILES);
  const compact = data.hobbies.filter((hobby) => !withPhoto.includes(hobby));
  const stats = [
    { value: data.stats.ideas, label: "patronen en uitleg" },
    { value: data.stats.workshops, label: "workshops" },
    { value: data.stats.upcomingEvents, label: "evenementen gepland" },
    { value: tools.length, label: "gratis hobbytools" },
  ].filter((stat) => stat.value > 0);

  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      {/* 1. Hero: one primary action */}
      <section className="relative isolate overflow-hidden bg-[var(--foreground)]">
        <div className="absolute inset-0" aria-hidden>
          <Image src={LANDING_IMAGES.hero} alt="" fill priority sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-[var(--foreground)]/60 md:bg-transparent md:bg-gradient-to-r md:from-[var(--foreground)]/90 md:via-[var(--foreground)]/60 md:to-[var(--foreground)]/10" />
        </div>
        <Container className="relative flex min-h-[640px] flex-col justify-end pb-16 pt-24 md:min-h-[min(88dvh,720px)] md:justify-center md:pb-24">
          <p className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.03em] text-white">
            Hobbysalon
          </p>
          <h1 className="mt-4 max-w-[680px] font-[family-name:var(--font-heading)] text-4xl font-bold leading-tight tracking-[-0.035em] text-white [text-wrap:balance] md:text-6xl">
            Voor iedereen die
            <br className="hidden md:block" /> graag iets moois maakt
          </h1>
          <p className="mt-6 max-w-[680px] text-lg leading-relaxed text-white/90 [text-wrap:pretty] md:text-xl">
            {copy.heroSubheadline}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="min-h-12 bg-[var(--accent)] px-6 text-lg text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] active:scale-[0.98]"
            >
              <a href={copy.primaryCta.href}>
                {copy.primaryCta.label}
                <ArrowRight size={20} aria-hidden />
              </a>
            </Button>
            <Link
              href={copy.secondaryCta.href}
              className="inline-flex min-h-12 items-center rounded-lg border border-white/40 bg-white/10 px-6 text-lg font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {copy.secondaryCta.label}
            </Link>
          </div>
          {stats.length > 0 ? (
            <dl className="mt-12 grid max-w-[720px] grid-cols-2 gap-x-8 gap-y-4 border-t border-white/25 pt-6 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="font-[family-name:var(--font-heading)] text-3xl font-bold text-white">
                    {nl.format(stat.value)}
                  </dd>
                  <dd className="text-base text-white/80">{stat.label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Container>
      </section>

      {/* 2. Hobby picker: the main way in */}
      {data.hobbies.length > 0 ? (
        <section id="hobby" aria-labelledby="hobby-titel" className="scroll-mt-20">
          <Container className="py-16 md:py-24">
            <RevealOnView>
              <h2 id="hobby-titel" className={H2}>
                {copy.hobbyPicker.title}
              </h2>
              <p className={LEAD}>{copy.hobbyPicker.body}</p>
            </RevealOnView>
            <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {withPhoto.map((hobby) => (
                <li key={hobby.slug}>
                  <Link
                    href={`/${hobby.slug}`}
                    className="group block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transform-none"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={hobby.image!}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 25vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 p-4">
                      <span className="min-w-0">
                        <span className="block text-lg font-bold text-[var(--foreground)]">{hobby.name}</span>
                        <span className="block text-base text-[var(--muted)]">
                          {copy.hobbyPicker.ideasLabel(hobby.ideas)}
                        </span>
                      </span>
                      <ArrowRight size={20} aria-hidden className="shrink-0 text-[var(--accent-hover)]" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {compact.length > 0 ? (
              <ul className="mt-6 flex flex-wrap gap-3" aria-label="Meer hobby's">
                {compact.map((hobby) => (
                  <li key={hobby.slug}>
                    <Link
                      href={`/${hobby.slug}`}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-5 text-base font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      {hobby.name}
                      <span className="text-[var(--muted)]">{nl.format(hobby.ideas)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Container>
        </section>
      ) : null}

      {/* 3. Pain points */}
      <section className="bg-[var(--section-highlight)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{copy.pain.title}</h2>
          </RevealOnView>
          <ul className="mt-10 grid gap-4 md:grid-cols-2 md:gap-6">
            {copy.pain.items.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-lg leading-relaxed text-[var(--foreground)] [text-wrap:pretty]"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-10 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--accent-hover)] md:text-3xl">
            {copy.pain.closer}
          </p>
        </Container>
      </section>

      {/* 4. What you find, and how it connects */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{copy.discover.title}</h2>
            <p className={LEAD}>{copy.discover.body}</p>
          </RevealOnView>
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <Link
              href={copy.discover.items[0].href}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-72 lg:flex-1">
                <Image
                  src={LANDING_IMAGES.workshop}
                  alt="Deelnemers aan een creatieve workshop"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none"
                />
              </div>
              <div className="flex flex-col p-6">
                <h3 className="text-2xl font-bold text-[var(--foreground)]">{copy.discover.items[0].title}</h3>
                <p className="mt-3 text-lg leading-relaxed text-[var(--muted)]">{copy.discover.items[0].body}</p>
                <span className="inline-flex items-center gap-2 pt-4 text-lg font-semibold text-[var(--accent-hover)]">
                  {copy.discover.items[0].cta}
                  <ArrowRight size={18} aria-hidden />
                </span>
              </div>
            </Link>
            <ul className="grid gap-4 sm:grid-cols-2">
              {copy.discover.items.slice(1).map((item) => {
                const Icon = DISCOVER_ICONS[item.href] ?? Scissors;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    >
                      <Icon size={28} aria-hidden className="text-[var(--accent-hover)]" />
                      <h3 className="mt-4 text-xl font-bold text-[var(--foreground)]">{item.title}</h3>
                      <p className="mt-2 text-base leading-relaxed text-[var(--muted)] md:text-lg">{item.body}</p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-4 text-base font-semibold text-[var(--accent-hover)]">
                        {item.cta}
                        <ArrowRight size={18} aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </Container>
      </section>

      {/* 5. How it works: 1 + 2 */}
      <section className="bg-[var(--section-alt)]">
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{copy.howItWorks.title}</h2>
          </RevealOnView>
          <ol className="mt-10 grid gap-6 lg:grid-cols-2">
            <li className="flex flex-col rounded-2xl bg-[var(--foreground)] p-8 text-white lg:row-span-2">
              <span className="font-[family-name:var(--font-heading)] text-5xl font-bold text-[var(--accent)]">1</span>
              <h3 className="mt-4 text-2xl font-bold">{copy.howItWorks.steps[0].title}</h3>
              <p className="mt-3 text-lg leading-relaxed text-white/85">{copy.howItWorks.steps[0].body}</p>
              <a href="#hobby" className="mt-auto inline-flex min-h-12 items-center gap-2 pt-6 text-lg font-semibold text-white underline-offset-4 hover:underline">
                {copy.primaryCta.label}
                <ArrowRight size={20} aria-hidden />
              </a>
            </li>
            {copy.howItWorks.steps.slice(1).map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
                <span className="font-[family-name:var(--font-heading)] text-4xl font-bold text-[var(--accent-hover)]">
                  {index + 2}
                </span>
                <h3 className="mt-3 text-xl font-bold text-[var(--foreground)]">{step.title}</h3>
                <p className="mt-2 text-lg leading-relaxed text-[var(--muted)]">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* 6. From inspiration to project */}
      <section>
        <Container className="py-16 md:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <RevealOnView>
              <h2 className={H2}>{copy.fromInspiration.title}</h2>
              <p className={LEAD}>{copy.fromInspiration.body}</p>
              <ol className="mt-8 space-y-6">
                {copy.fromInspiration.moments.map((moment, index) => (
                  <li key={moment.title} className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--section-highlight)] text-lg font-bold text-[var(--accent-hover)]">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-xl font-bold text-[var(--foreground)]">{moment.title}</span>
                      <span className="mt-1 block text-lg leading-relaxed text-[var(--muted)]">{moment.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <Link href={copy.fromInspiration.cta.href} className={`${TEXT_LINK} mt-6`}>
                {copy.fromInspiration.cta.label}
                <ArrowRight size={20} aria-hidden />
              </Link>
            </RevealOnView>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              <Image
                src={LANDING_IMAGES.craftsGrid}
                alt="Materialen en een half afgewerkt project op tafel"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* 7. Tools */}
      {featuredTools.length > 0 ? (
        <section className="bg-[var(--section-highlight)]">
          <Container className="py-16 md:py-24">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
              <RevealOnView>
                <Calculator size={32} aria-hidden className="text-[var(--accent-hover)]" />
                <h2 className={`${H2} mt-4`}>{copy.hobbyTools.title}</h2>
                <p className={LEAD}>{copy.hobbyTools.body(tools.length)}</p>
                <Link href={copy.hobbyTools.cta.href} className={`${TEXT_LINK} mt-6`}>
                  {copy.hobbyTools.cta.label}
                  <ArrowRight size={20} aria-hidden />
                </Link>
              </RevealOnView>
              <ul className="grid gap-3 sm:grid-cols-2">
                {featuredTools.map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 text-lg font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      {tool.title}
                      <ArrowRight size={18} aria-hidden className="shrink-0 text-[var(--accent-hover)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ) : null}

      {/* 8. Why Hobbysalon: equal cards, history as proof */}
      <section>
        <Container className="py-16 md:py-24">
          <RevealOnView>
            <h2 className={H2}>{copy.why.title}</h2>
          </RevealOnView>
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <figure className="relative overflow-hidden rounded-2xl bg-[var(--foreground)] p-8 text-white">
              <Image
                src={LANDING_IMAGES.community}
                alt=""
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover opacity-35"
              />
              <div className="relative">
                <h3 className="text-2xl font-bold">{copy.why.items[3].title}</h3>
                <p className="mt-4 text-lg leading-relaxed text-white/90">{copy.why.items[3].body}</p>
              </div>
            </figure>
            <ul className="grid gap-4">
              {copy.why.items.slice(0, 3).map((item) => (
                <li key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
                  <h3 className="text-xl font-bold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-2 text-lg leading-relaxed text-[var(--muted)]">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* 9. FAQ */}
      <section className="bg-[var(--section-highlight)]">
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
                <div className="pb-5 text-lg leading-relaxed text-[var(--muted)]">
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

      {/* 10. Closing: same action as the hero */}
      <section className="bg-[var(--foreground)]">
        <Container className="py-16 text-center md:py-24">
          <RevealOnView>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-white md:text-4xl">
              {copy.closing.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[48ch] text-lg leading-relaxed text-white/80">{copy.closing.body}</p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href={copy.closing.primaryCta.href}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-lg font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
              >
                {copy.closing.primaryCta.label}
                <ArrowRight size={20} aria-hidden />
              </a>
              <Link
                href={copy.closing.secondaryCta.href}
                className="inline-flex min-h-12 items-center rounded-lg border border-white/30 bg-white/10 px-6 text-lg font-semibold text-white/95 transition-colors hover:bg-white/20"
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
