import Link from "next/link";
import { Container } from "@/components/ui/container";

type ToolLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function ToolLayout({ title, description, children }: ToolLayoutProps) {
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
        <h1 className="text-3xl font-bold text-[var(--foreground)]">{title}</h1>
        <p className="mt-2 text-[var(--muted)]">{description}</p>
      </header>

      {children}
    </Container>
  );
}
