import { cn } from "@/lib/utils";

type EntityLinkBlockProps = {
  title: string;
  children?: React.ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
  className?: string;
};

export function EntityLinkBlock({
  title,
  children,
  emptyMessage = "Binnenkort beschikbaar",
  isEmpty = false,
  className,
}: EntityLinkBlockProps) {
  return (
    <section className={cn("py-12 md:py-16", className)}>
      <h2 className="mb-6 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
        {title}
      </h2>
      {isEmpty ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-10 text-center text-[var(--muted)]">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">{children}</div>
      )}
    </section>
  );
}
