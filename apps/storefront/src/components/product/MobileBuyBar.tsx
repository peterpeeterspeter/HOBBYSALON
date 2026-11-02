import { PriceDisplay } from "@/components/domain/price-display";

type MobileBuyBarProps = {
  price: { amount: number; currency_code: string } | null;
  label: string;
};

/**
 * Fixed bar on small screens. The buy card sits below the gallery there,
 * so this keeps price and the next step in view. Hidden on desktop, where
 * the buy card is sticky.
 */
export function MobileBuyBar({ price, label }: MobileBuyBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {price ? (
          <PriceDisplay amount={price.amount} currencyCode={price.currency_code} size="lg" />
        ) : (
          <span />
        )}
        <a
          href="#bestellen"
          className="rounded-lg bg-[var(--accent)] px-6 py-3 text-base font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          {label}
        </a>
      </div>
    </div>
  );
}
