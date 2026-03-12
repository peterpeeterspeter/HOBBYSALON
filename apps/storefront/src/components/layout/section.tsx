import { cn } from "@/lib/utils";

type SectionProps = {
  children: React.ReactNode;
  /** Background variant for visual rhythm between sections */
  variant?: "default" | "alt" | "highlight";
  /** Vertical padding size */
  spacing?: "sm" | "md" | "lg";
  /** Show decorative terracotta divider above the section */
  divider?: boolean;
  className?: string;
};

const VARIANT_BG: Record<NonNullable<SectionProps["variant"]>, string> = {
  default: "",
  alt: "bg-[var(--section-alt)]",
  highlight: "bg-[var(--section-highlight)]",
};

const SPACING: Record<NonNullable<SectionProps["spacing"]>, string> = {
  sm: "py-8",
  md: "py-12",
  lg: "py-16",
};

function Section({
  children,
  variant = "default",
  spacing = "md",
  divider = false,
  className,
}: SectionProps) {
  return (
    <>
      {divider && (
        <div className="flex items-center justify-center py-2" aria-hidden="true">
          <span className="h-px w-16 bg-[var(--divider-accent)]/30" />
          <span className="mx-3 h-1.5 w-1.5 rotate-45 bg-[var(--divider-accent)]/50" />
          <span className="h-px w-16 bg-[var(--divider-accent)]/30" />
        </div>
      )}
      <section
        className={cn(
          VARIANT_BG[variant],
          SPACING[spacing],
          className
        )}
      >
        {children}
      </section>
    </>
  );
}

export { Section };
export type { SectionProps };
