import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        domain:
          "bg-[var(--accent)]/10 text-[var(--accent)]",
        difficulty: "",
        format:
          "bg-[var(--foreground)]/8 text-[var(--foreground)]",
        status:
          "bg-[var(--muted)]/15 text-[var(--muted)]",
        new:
          "bg-[var(--success)]/15 text-[var(--success)]",
        popular:
          "bg-[var(--warning)]/15 text-[var(--warning)]",
        soldOut:
          "bg-[var(--error)]/15 text-[var(--error)]",
      },
      difficulty: {
        beginner:
          "bg-[var(--difficulty-beginner)]/15 text-[var(--difficulty-beginner)]",
        intermediate:
          "bg-[var(--difficulty-intermediate)]/15 text-[var(--difficulty-intermediate)]",
        advanced:
          "bg-[var(--difficulty-advanced)]/15 text-[var(--difficulty-advanced)]",
      },
    },
    defaultVariants: {
      variant: "domain",
    },
  }
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, difficulty, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        badgeVariants({ variant: difficulty ? "difficulty" : variant, difficulty }),
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
