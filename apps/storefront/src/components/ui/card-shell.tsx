import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardShellVariants = cva(
  "rounded-lg border bg-[var(--card)] overflow-hidden transition-all duration-[var(--transition-normal)]",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] shadow-[var(--shadow-sm)]",
        interactive:
          "border-[var(--border)] shadow-[var(--shadow-sm)] hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)] cursor-pointer",
        featured:
          "border-[var(--accent)]/40 shadow-[var(--shadow-md)] ring-1 ring-[var(--accent)]/10",
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
      },
    },
    defaultVariants: {
      variant: "interactive",
      padding: "md",
    },
  }
);

type CardShellProps = React.ComponentProps<"div"> &
  VariantProps<typeof cardShellVariants>;

function CardShell({
  className,
  variant,
  padding,
  children,
  ...props
}: CardShellProps) {
  return (
    <div
      className={cn(cardShellVariants({ variant, padding }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { CardShell, cardShellVariants };
export type { CardShellProps };
