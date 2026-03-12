"use client";

/**
 * Client component that displays a LaoZhang-generated image with fallback on 404/error.
 * Use when the image may not exist yet (e.g. before running generate-landing-images.ts).
 */

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type LaoZhangImageFallbackProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallback?: React.ReactNode;
};

function LaoZhangImageFallback({
  src,
  alt,
  width = 96,
  height = 96,
  className,
  fallback,
}: LaoZhangImageFallbackProps) {
  const [error, setError] = useState(false);

  if (error && fallback) {
    return <>{fallback}</>;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn("object-cover", className)}
      onError={() => setError(true)}
    />
  );
}

export { LaoZhangImageFallback };
