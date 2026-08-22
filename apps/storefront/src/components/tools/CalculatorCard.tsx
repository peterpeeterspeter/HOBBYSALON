import { CardShell } from "@/components/ui/card-shell";

type CalculatorCardProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function CalculatorCard({ title, children, className }: CalculatorCardProps) {
  return (
    <CardShell
      variant="default"
      padding="lg"
      className={`border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)] ${className ?? ""}`}
    >
      {title ? (
        <h2 className="mb-5 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
          {title}
        </h2>
      ) : null}
      {children}
    </CardShell>
  );
}
