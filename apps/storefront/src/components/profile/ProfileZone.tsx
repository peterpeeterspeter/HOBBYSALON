import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** "highlight" gives the zone a warm background, to set it apart. */
  tone?: "card" | "highlight";
  children: ReactNode;
};

/**
 * One clear block on /profile: an icon, a title and one line of context,
 * then its parts separated by thin lines. Zones replace a long column of
 * equal looking sections.
 */
export function ProfileZone({ id, icon: Icon, title, description, tone = "card", children }: Props) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titel`}
      className={`mt-10 scroll-mt-24 rounded-3xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)] md:p-10 ${
        tone === "highlight" ? "border-[var(--accent)]/40 bg-[var(--section-highlight)]" : "bg-[var(--card)]"
      }`}
    >
      <header className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent-hover)]">
          <Icon size={26} aria-hidden />
        </span>
        <div>
          <h2 id={`${id}-titel`} className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.02em] text-[var(--foreground)]">
            {title}
          </h2>
          <p className="mt-1 max-w-[60ch] text-lg leading-relaxed text-[var(--muted)]">{description}</p>
        </div>
      </header>
      <div className="mt-8 [&>*+*]:mt-10 [&>*+*]:border-t [&>*+*]:border-[var(--border)] [&>*+*]:pt-10">{children}</div>
    </section>
  );
}
