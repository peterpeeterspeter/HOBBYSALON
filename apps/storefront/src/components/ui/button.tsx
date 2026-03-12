import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-[var(--transition-fast)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] active:scale-[0.98]",
        secondary:
          "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5",
        ghost:
          "text-[var(--accent)] hover:bg-[var(--accent)]/10 hover:underline underline-offset-2",
        danger:
          "bg-[var(--error)] text-white hover:opacity-90 active:scale-[0.98]",
      },
      size: {
        sm: "px-3 py-1.5 text-sm min-h-[36px]",
        md: "px-5 py-2.5 text-base min-h-[44px]",
        lg: "px-6 py-3 text-lg min-h-[var(--touch-target-min)]",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild,
  children,
  ...rest
}: ButtonProps) {
  const combinedClassName = cn(
    buttonVariants({ variant, size, fullWidth }),
    className
  );

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      ...child.props,
      className: cn(combinedClassName, child.props?.className),
    });
  }

  const { asChild: _a, ...buttonProps } = rest as typeof rest & { asChild?: boolean };
  return (
    <button className={combinedClassName} {...buttonProps}>
      {children}
    </button>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
