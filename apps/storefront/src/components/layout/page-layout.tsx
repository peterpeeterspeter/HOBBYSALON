import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/container";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageLayoutProps = {
  children: React.ReactNode;
  /** Page title */
  title?: string;
  /** Subtitle / description */
  description?: string;
  /** Breadcrumb trail */
  breadcrumbs?: BreadcrumbItem[];
  /** Container width */
  size?: "narrow" | "default" | "wide";
  className?: string;
};

function PageLayout({
  children,
  title,
  description,
  breadcrumbs,
  size = "default",
  className,
}: PageLayoutProps) {
  return (
    <Container size={size} className={cn("py-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
          <ol className="flex flex-wrap gap-2">
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">/</span>}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="hover:text-[var(--foreground)] transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-[var(--foreground)]">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {title && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)] md:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-lg text-[var(--muted)]">{description}</p>
          )}
        </div>
      )}

      {children}
    </Container>
  );
}

export { PageLayout };
export type { PageLayoutProps, BreadcrumbItem };
