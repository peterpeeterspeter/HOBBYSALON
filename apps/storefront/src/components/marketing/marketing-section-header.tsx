import { cn } from "@/lib/utils";

type MarketingSectionHeaderProps = {
  title: string;
  description?: string;
  className?: string;
  centered?: boolean;
};

function MarketingSectionHeader({
  title,
  description,
  className,
  centered = true,
}: MarketingSectionHeaderProps) {
  return (
    <div className={cn(centered && "text-center", className)}>
      <h2
        className={cn(
          "text-3xl font-bold text-[var(--foreground)] font-[family-name:var(--font-heading)] md:text-4xl",
          centered && "mx-auto"
        )}
      >
        {title}
      </h2>
      <span
        className={cn(
          "mt-3 block h-[3px] w-10 rounded-full bg-[var(--accent)]",
          centered && "mx-auto"
        )}
        aria-hidden="true"
      />
      {description && (
        <p
          className={cn(
            "mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]",
            centered && "mx-auto"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export { MarketingSectionHeader };
export type { MarketingSectionHeaderProps };
