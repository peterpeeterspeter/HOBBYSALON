import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { offerStatusLabel } from "@/lib/dashboard/offer-status";
import type { OfferStatus } from "@/lib/dashboard/copy";

/** Page title + one optional primary action. Every dashboard page starts with this. */
export function DashboardPageHeader({
  title,
  lead,
  action,
  back,
}: {
  title: string;
  lead?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8 space-y-3">
      {back ? (
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center text-lg font-semibold text-[var(--accent-hover)] underline-offset-4 hover:underline"
        >
          {"\u2190"} {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight text-[var(--foreground)] md:text-4xl">
            {title}
          </h1>
          {lead ? (
            <p className="mt-2 max-w-[60ch] text-lg leading-relaxed text-[var(--muted)]">
              {lead}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

const STATUS_STYLE: Record<OfferStatus, string> = {
  visible: "bg-[#e3f1e7] text-[#245236] border-[#b9dcc4]",
  draft: "bg-[var(--section-alt)] text-[var(--foreground)] border-[var(--border-strong)]",
  review: "bg-[#fdf1d8] text-[#6b4a0f] border-[#efd59a]",
  payment: "bg-[#fdf1d8] text-[#6b4a0f] border-[#efd59a]",
  expired: "bg-[#f8e1de] text-[#7a2b22] border-[#ebbcb5]",
};

export function StatusPill({ status }: { status: OfferStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-base font-semibold",
        STATUS_STYLE[status]
      )}
    >
      {offerStatusLabel(status)}
    </span>
  );
}

/** Success / error feedback from server actions (?success= / ?error=). */
export function FlashMessage({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "mb-6 rounded-xl border px-5 py-4 text-lg",
        error
          ? "border-[#ebbcb5] bg-[#f8e1de] text-[#7a2b22]"
          : "border-[#b9dcc4] bg-[#e3f1e7] text-[#245236]"
      )}
    >
      {error ?? success}
    </div>
  );
}

/** At most one notice per page: the single thing the user should know now. */
export function DashboardNotice({
  title,
  children,
  action,
  tone = "info",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "info" | "attention";
}) {
  return (
    <section
      className={cn(
        "mb-8 rounded-2xl border p-6",
        tone === "attention"
          ? "border-[#efd59a] bg-[#fdf6e7]"
          : "border-[var(--border)] bg-[var(--section-highlight)]"
      )}
    >
      <h2 className="text-xl font-bold text-[var(--foreground)]">{title}</h2>
      {children ? (
        <div className="mt-2 max-w-[65ch] text-lg leading-relaxed text-[var(--muted)]">
          {children}
        </div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export function EmptyBlock({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--card)] px-6 py-10">
      <p className="text-xl font-semibold text-[var(--foreground)]">{title}</p>
      {children ? (
        <div className="mt-2 max-w-[60ch] text-lg text-[var(--muted)]">{children}</div>
      ) : null}
    </div>
  );
}
