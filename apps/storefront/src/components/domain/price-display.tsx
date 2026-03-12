import { cn } from "@/lib/utils";

type PriceDisplayProps = {
  /** Price amount in cents */
  amount: number;
  currencyCode?: string;
  /** Original price in cents (for sale display) */
  originalAmount?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
};

function formatPrice(cents: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function PriceDisplay({
  amount,
  currencyCode = "EUR",
  originalAmount,
  className,
  size = "md",
}: PriceDisplayProps) {
  if (amount <= 0) return null;

  const sizeClasses = {
    sm: "text-sm font-semibold",
    md: "text-base font-semibold",
    lg: "text-xl font-bold",
  };

  const priceStr = formatPrice(amount, currencyCode);
  const isOnSale = originalAmount && originalAmount > amount;

  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className={cn(sizeClasses[size], "text-[var(--foreground)]")}>
        {priceStr}
      </span>
      {isOnSale && (
        <span className="text-sm text-[var(--muted)] line-through">
          {formatPrice(originalAmount, currencyCode)}
        </span>
      )}
    </div>
  );
}

export { PriceDisplay, formatPrice };
export type { PriceDisplayProps };
