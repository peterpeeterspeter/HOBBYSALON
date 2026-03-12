import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "w-full rounded-lg border bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors duration-[var(--transition-fast)] focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed min-h-[120px] resize-y",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/30",
        error:
          "border-[var(--error)] focus:ring-[var(--error)]/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type TextareaProps = React.ComponentProps<"textarea"> &
  VariantProps<typeof textareaVariants> & {
    label?: string;
    error?: string;
  };

function Textarea({
  className,
  variant,
  label,
  error,
  id,
  ...props
}: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-sm font-medium text-[var(--foreground)]"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cn(
          textareaVariants({ variant: error ? "error" : variant }),
          className
        )}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
      {error && (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export { Textarea, textareaVariants };
export type { TextareaProps };
