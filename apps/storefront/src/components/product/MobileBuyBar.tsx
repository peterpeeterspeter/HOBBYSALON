type MobileBuyBarProps = {
  label: string;
  title: string;
};

/**
 * Fixed bar on small screens. The buy card sits below the gallery there,
 * so this keeps the next step in view. It shows no price: the buy card
 * owns the price of the selected variant, and a second copy here would go
 * stale after a variant change. Hidden on desktop, where the buy card is
 * sticky.
 */
export function MobileBuyBar({ label, title }: MobileBuyBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <span className="min-w-0 truncate text-base font-semibold text-[var(--foreground)]">
          {title}
        </span>
        <a
          href="#bestellen"
          className="shrink-0 rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          {label}
        </a>
      </div>
    </div>
  );
}
