import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

type ListingHeroBandProps = {
  title: string;
  lead?: string;
  imageSrc: string;
  breadcrumb?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "default" | "compact";
};

/**
 * Full-bleed craft photo + scrim for discovery listing pages.
 * Preserve Brand Kit tokens; keep search/filters as children.
 */
export function ListingHeroBand({
  title,
  lead,
  imageSrc,
  breadcrumb,
  children,
  footer,
  className,
  size = "default",
}: ListingHeroBandProps) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden border-b border-[var(--border)] bg-[var(--foreground)]",
        className
      )}
    >
      <div className="absolute inset-0" aria-hidden>
        <img
          src={imageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--foreground)]/90 via-[var(--foreground)]/55 to-[var(--foreground)]/25 md:bg-gradient-to-r md:from-[var(--foreground)]/88 md:via-[var(--foreground)]/55 md:to-[var(--foreground)]/20" />
      </div>

      <Container
        className={cn(
          "relative",
          size === "compact" ? "py-8 sm:py-10" : "py-10 sm:py-12 lg:py-14"
        )}
      >
        {breadcrumb}
        <h1
          className={cn(
            "max-w-3xl font-[family-name:var(--font-heading)] font-bold leading-[1.1] tracking-[-0.035em] text-white",
            size === "compact"
              ? "text-3xl sm:text-4xl"
              : "text-3xl sm:text-4xl lg:text-5xl",
            breadcrumb ? "mt-4" : null
          )}
        >
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            {lead}
          </p>
        ) : null}
        {children ? <div className="mt-6 max-w-2xl">{children}</div> : null}
        {footer ? <div className="mt-4">{footer}</div> : null}
      </Container>
    </section>
  );
}

export function ListingSearchShell({
  id,
  name = "q",
  placeholder,
  defaultValue,
  label,
}: {
  id: string;
  name?: string;
  placeholder: string;
  defaultValue?: string;
  label: string;
}) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex flex-col gap-2 rounded-[1rem] border border-white/25 bg-white/95 p-2 shadow-[var(--shadow-md)] sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            size={20}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]"
          />
          <input
            id={id}
            type="search"
            name={name}
            defaultValue={defaultValue ?? ""}
            placeholder={placeholder}
            className="min-h-12 w-full rounded-[0.75rem] bg-transparent py-2 pl-11 pr-3 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]/80"
          />
        </div>
        <button
          type="submit"
          className="min-h-12 rounded-[0.75rem] bg-[var(--accent)] px-6 font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px"
        >
          Zoek
        </button>
      </div>
    </>
  );
}
