import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const containerVariants = cva(
  "mx-auto w-full px-4 sm:px-6 lg:px-8",
  {
    variants: {
      size: {
        narrow: "max-w-3xl",
        default: "max-w-6xl",
        wide: "max-w-7xl",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

type ContainerProps = React.ComponentProps<"div"> &
  VariantProps<typeof containerVariants>;

function Container({ className, size, children, ...props }: ContainerProps) {
  return (
    <div className={cn(containerVariants({ size }), className)} {...props}>
      {children}
    </div>
  );
}

export { Container, containerVariants };
export type { ContainerProps };
