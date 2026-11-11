import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";
import { formatBrusselsDateTime } from "@/lib/agenda/agenda-helpers";

type DateDisplayProps = {
  date: string;
  format?: "short" | "long" | "relative";
  showIcon?: boolean;
  showTime?: boolean;
  className?: string;
};

function formatDateShort(iso: string): string {
  return formatBrusselsDateTime(
    iso,
    {
      weekday: "short",
      day: "numeric",
      month: "short",
    },
    "nl-NL"
  );
}

function formatDateLong(iso: string): string {
  return formatBrusselsDateTime(
    iso,
    {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
    "nl-NL"
  );
}

function formatTime(iso: string): string {
  return formatBrusselsDateTime(
    iso,
    {
      hour: "2-digit",
      minute: "2-digit",
    },
    "nl-NL"
  );
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
