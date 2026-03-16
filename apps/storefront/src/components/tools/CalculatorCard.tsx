import { CardShell } from "@/components/ui/card-shell";

type CalculatorCardProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function CalculatorCard({ title, children, className }: CalculatorCardProps) {
  return (
    <CardShell variant="default" padding="lg" className={className}>
      {title && (
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          {title}
        </h2>
      )}
      {children}
    </CardShell>
  );
}
