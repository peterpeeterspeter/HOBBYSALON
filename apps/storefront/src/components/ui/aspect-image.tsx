import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

const aspectImageVariants = cva(
  "relative overflow-hidden rounded-md bg-[var(--border)]",
  {
    variants: {
      ratio: {
        square: "aspect-square",
        video: "aspect-video",
        portrait: "aspect-[3/4]",
      },
    },
    defaultVariants: {
      ratio: "video",
    },
  }
);

type AspectImageProps = VariantProps<typeof aspectImageVariants> & {
  src?: string | null;
  alt: string;
  className?: string;
  fill?: boolean;
};

function AspectImage({ src, alt, ratio, className, fill = true }: AspectImageProps) {
  if (!src) {
    return (
      <div className={cn(aspectImageVariants({ ratio }), "flex items-center justify-center text-[var(--muted)]", className)}>
        <ImageOff size={24} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={cn(aspectImageVariants({ ratio }), className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(
          "object-cover transition-transform duration-[var(--transition-normal)]",
          fill && "absolute inset-0 h-full w-full"
        )}
      />
    </div>
  );
}

export { AspectImage, aspectImageVariants };
export type { AspectImageProps };
