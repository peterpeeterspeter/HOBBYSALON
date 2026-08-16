import Link from "next/link";
import { Container } from "@/components/ui/container";

type ToolLayoutProps = {
  title: string;
  description: string;
  categoryLabel?: string;
  children: React.ReactNode;
};

export function ToolLayout({
  title,
  description,
  categoryLabel,
  children,
}: ToolLayoutProps) {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--section-highlight)]/40">
      <Container className="py-8 sm:py-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
          <ol className="flex flex-wrap gap-2">
            <li>
              <Link href="/" className="hover:text-[var(--foreground)]">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/tools" className="hover:text-[var(--foreground)]">
                Tools
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-[var(--foreground)]">{title}</li>
          </ol>
        </nav>

        <header className="mb-8 max-w-3xl">
          {categoryLabel ? (
            <p className="mb-2 text-sm font-bold uppercase tracking-wider text-[var(--accent)]">
              {categoryLabel}
            </p>
          ) : null}
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl">
            {title}
          </h1>
          <span
            className="mt-3 block h-[3px] w-12 rounded-full bg-[var(--accent)]"
            aria-hidden
          />
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            {description}
          </p>
        </header>

        {children}
      </Container>
    </div>
  );
}
