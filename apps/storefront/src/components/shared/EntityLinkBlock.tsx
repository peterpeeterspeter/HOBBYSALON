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
    <section className={cn("py-8", className)}>
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
        {title}
      </h2>
      {isEmpty ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-8 text-center text-[var(--muted)]">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      )}
    </section>
  );
}
