import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const skeletonVariants = cva(
  "animate-pulse bg-[var(--border)]",
  {
    variants: {
      variant: {
        text: "h-4 rounded",
        image: "rounded-md",
        card: "rounded-lg",
        circle: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "text",
    },
  }
);

type SkeletonProps = React.ComponentProps<"div"> &
  VariantProps<typeof skeletonVariants>;

function Skeleton({ className, variant, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(skeletonVariants({ variant }), className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Pre-composed skeleton for entity cards */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3", className)}>
      <Skeleton variant="image" className="aspect-video w-full" />
      <Skeleton variant="text" className="w-3/4" />
      <Skeleton variant="text" className="w-1/2" />
      <Skeleton variant="text" className="w-1/4" />
    </div>
  );
}

export { Skeleton, CardSkeleton, skeletonVariants };
export type { SkeletonProps };
