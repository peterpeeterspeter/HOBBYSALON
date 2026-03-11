import { cn } from "@/lib/utils";

type SectionProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function Section({ title, children, className }: SectionProps) {
  return (
    <section className={cn("py-8", className)}>
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}
