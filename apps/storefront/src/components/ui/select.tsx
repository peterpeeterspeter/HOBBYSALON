import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type SelectProps = React.ComponentProps<"select"> & {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

function Select({
  className,
  label,
  error,
  options,
  placeholder,
  id,
  ...props
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-[var(--foreground)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "w-full appearance-none rounded-lg border bg-[var(--card)] px-3 py-2.5 pr-10 text-[var(--foreground)] transition-colors duration-[var(--transition-fast)] focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]",
            error
              ? "border-[var(--error)] focus:ring-[var(--error)]/30"
              : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/30",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          size={18}
          aria-hidden="true"
        />
      </div>
      {error && (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export { Select };
export type { SelectProps };
