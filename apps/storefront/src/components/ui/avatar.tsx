import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

const avatarVariants = cva(
  "relative inline-flex items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] overflow-hidden shrink-0",
  {
    variants: {
      size: {
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-14 w-14 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

type AvatarProps = VariantProps<typeof avatarVariants> & {
  src?: string | null;
  alt?: string;
  className?: string;
};

function Avatar({ src, alt, size, className }: AvatarProps) {
  const iconSize = size === "sm" ? 14 : size === "lg" ? 24 : 18;

  if (src) {
    return (
      <img
        src={src}
        alt={alt || ""}
        className={cn(avatarVariants({ size }), "object-cover", className)}
        loading="lazy"
      />
    );
  }

  return (
    <span className={cn(avatarVariants({ size }), className)} aria-hidden="true">
      <User size={iconSize} />
    </span>
  );
}

export { Avatar, avatarVariants };
export type { AvatarProps };
