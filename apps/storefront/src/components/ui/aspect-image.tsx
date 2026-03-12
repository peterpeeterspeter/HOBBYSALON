import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";
import { LANDING_IMAGES } from "./ai-generated-image";
import { AspectImagePlaceholder } from "./aspect-image-placeholder";

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
  /** When no src, use LaoZhang placeholder instead of icon. Set to "placeholderProduct" for product cards. */
  fallbackImage?: keyof typeof LANDING_IMAGES | null;
};

function AspectImage({ src, alt, ratio, className, fill = true, fallbackImage }: AspectImageProps) {
  const placeholderSrc = fallbackImage ? LANDING_IMAGES[fallbackImage] : null;

  if (!src) {
    if (placeholderSrc) {
      return (
        <AspectImagePlaceholder
          src={placeholderSrc}
          alt={alt}
          ratio={ratio}
          className={className}
        />
      );
    }
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
          "object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:group-hover:transform-none",
          fill && "absolute inset-0 h-full w-full"
        )}
      />
    </div>
  );
}

export { AspectImage, aspectImageVariants };
export type { AspectImageProps };
