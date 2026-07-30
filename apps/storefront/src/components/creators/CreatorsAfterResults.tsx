import Link from "next/link";

/**
 * Secondary maker onboarding — quiet, after the grid (hero already has a quiet link).
 */
export function CreatorsAfterResults() {
  return (
    <section className="mt-12 rounded-[12px] border border-[var(--border)] bg-[var(--section-highlight)] p-5 sm:p-6">
      <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
        Zelf iets verkopen?
      </h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
        Plaats handgemaakte creaties of restanten en ontvang aanvragen van
        hobbyisten in België en Nederland.
      </p>
      <Link
        href="/voor-makers"
        className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--accent)] underline underline-offset-4 hover:text-[var(--accent-hover)]"
      >
        Ontdek hoe het werkt
      </Link>
    </section>
  );
}

