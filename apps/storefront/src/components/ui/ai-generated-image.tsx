/**
 * Displays LaoZhang (Nano Banana Pro) generated images used in the design system.
 * Images are pre-generated via scripts/generate-landing-images.ts and stored in public/landing/.
 * @see https://docs.laozhang.ai/en/api-capabilities/nano-banana-pro-image
 */

import Image from "next/image";
import { cn } from "@/lib/utils";

export const LANDING_IMAGES = {
  hero: "/landing/hero.jpg",
  craftsGrid: "/landing/crafts-grid.jpg",
  workshop: "/landing/workshop.jpg",
  community: "/landing/community.jpg",
  emptyCrafts: "/landing/empty-crafts.jpg",
  emptySearch: "/landing/empty-search.jpg",
  placeholderProduct: "/landing/placeholder-product.jpg",
  placeholderWorkshop: "/landing/placeholder-workshop.jpg",
  placeholderEvent: "/landing/placeholder-event.jpg",
  placeholderArticle: "/landing/placeholder-article.jpg",
  placeholderCreator: "/landing/placeholder-creator.jpg",
  placeholderProject: "/landing/placeholder-project.jpg",
  domainHero: "/landing/domain-hero.jpg",
  placeholderDefault: "/landing/placeholder-default.jpg",
} as const;

export type LandingImageKey = keyof typeof LANDING_IMAGES;

type AIGeneratedImageProps = {
  /** Key of the pre-generated image from the design set */
  image: LandingImageKey;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
};

function AIGeneratedImage({
  image,
  alt,
  className,
  fill = false,
  sizes,
  priority = false,
}: AIGeneratedImageProps) {
  const src = LANDING_IMAGES[image];

  if (fill) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes={sizes ?? "100vw"}
          priority={priority}
        />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      className={cn("object-cover", className)}
      sizes={sizes}
      priority={priority}
    />
  );
}

export { AIGeneratedImage };
