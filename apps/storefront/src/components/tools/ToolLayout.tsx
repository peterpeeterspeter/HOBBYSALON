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
    <Container className="py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/tools" className="hover:text-[var(--foreground)]">
              Tools
            </Link>
          </li>
          <li>/</li>
          <li className="text-[var(--foreground)]">{title}</li>
        </ol>
      </nav>

      <header className="mb-8">
        {categoryLabel && (
          <p className="mb-1.5 text-sm font-bold uppercase tracking-wider text-[var(--accent)]">
            {categoryLabel}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--foreground)]">
          {title}
        </h1>
        <p className="mt-2 text-[var(--muted)]">{description}</p>
      </header>

      {children}
    </Container>
  );
}
