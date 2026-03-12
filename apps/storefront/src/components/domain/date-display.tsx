import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";

type DateDisplayProps = {
  date: string;
  format?: "short" | "long" | "relative";
  showIcon?: boolean;
  showTime?: boolean;
  className?: string;
};

function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function DateDisplay({
  date,
  format = "long",
  showIcon = false,
  showTime = false,
  className,
}: DateDisplayProps) {
  const formatted = format === "short" ? formatDateShort(date) : formatDateLong(date);
  const time = showTime ? formatTime(date) : null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-[var(--muted)]", className)}>
      {showIcon && <Calendar size={14} aria-hidden="true" className="shrink-0" />}
      <time dateTime={date}>{formatted}</time>
      {time && (
        <>
          <Clock size={14} aria-hidden="true" className="shrink-0 ml-1" />
          <span>{time}</span>
        </>
      )}
    </span>
  );
}

export { DateDisplay, formatDateShort, formatDateLong };
export type { DateDisplayProps };
