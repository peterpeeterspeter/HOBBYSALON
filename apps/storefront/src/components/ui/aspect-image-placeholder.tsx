"use client";

/**
 * Client wrapper for LaoZhang placeholder images with fallback to icon on 404/error.
 */

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { aspectImageVariants } from "./aspect-image";
import type { VariantProps } from "class-variance-authority";

type AspectImagePlaceholderProps = VariantProps<typeof aspectImageVariants> & {
  src: string;
  alt: string;
  className?: string;
};

function AspectImagePlaceholder({
  src,
  alt,
  ratio,
  className,
}: AspectImagePlaceholderProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={cn(
          aspectImageVariants({ ratio }),
          "flex items-center justify-center text-[var(--muted)]",
          className
        )}
      >
        <ImageOff size={24} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={cn(aspectImageVariants({ ratio }), className)}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 33vw"
        onError={() => setError(true)}
      />
    </div>
  );
}

export { AspectImagePlaceholder };
