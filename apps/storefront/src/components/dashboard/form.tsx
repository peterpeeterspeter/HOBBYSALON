import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Form building blocks for the dashboard: label above the field, optional
 * help text, 48px fields, 18px text. Server-component friendly (no state).
 */

const fieldClass =
  "w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--card)] px-4 py-3 text-lg text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30";

export function FormSection({
  title,
  lead,
  children,
  id,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <fieldset
      id={id}
      className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-7"
    >
      <legend className="sr-only">{title}</legend>
      <h2 aria-hidden="true" className="text-2xl font-bold text-[var(--foreground)]">
        {title}
      </h2>
      {lead ? <p className="mt-1 max-w-[60ch] text-lg text-[var(--muted)]">{lead}</p> : null}
      <div className="mt-5 grid gap-5 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

type BaseFieldProps = {
  label: string;
  name: string;
  help?: string;
  required?: boolean;
  wide?: boolean;
};

function FieldShell({
  label,
  name,
  help,
  required,
  wide,
  children,
}: BaseFieldProps & { children: ReactNode }) {
  const helpId = help ? `${name}-help` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", wide && "md:col-span-2")}>
      <label htmlFor={name} className="text-lg font-semibold text-[var(--foreground)]">
        {label}
        {required ? <span className="text-[var(--muted)]"> (verplicht)</span> : null}
      </label>
      {children}
      {help ? (
        <p id={helpId} className="text-base text-[var(--muted)]">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  help,
  required,
  wide,
  defaultValue,
  type = "text",
  inputMode,
  min,
  step,
  placeholder,
}: BaseFieldProps & {
  defaultValue?: string | number | null;
  type?: "text" | "number" | "datetime-local" | "email" | "url";
  inputMode?: "decimal" | "numeric";
  min?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label} name={name} help={help} required={required} wide={wide}>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? undefined}
        inputMode={inputMode}
        min={min}
        step={step}
        placeholder={placeholder}
        aria-describedby={help ? `${name}-help` : undefined}
        className={fieldClass}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  name,
  help,
  required,
  defaultValue,
  rows = 5,
}: BaseFieldProps & { defaultValue?: string | null; rows?: number }) {
  return (
    <FieldShell label={label} name={name} help={help} required={required} wide>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue ?? undefined}
        aria-describedby={help ? `${name}-help` : undefined}
        className={fieldClass}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  help,
  required,
  wide,
  defaultValue,
  options,
}: BaseFieldProps & {
  defaultValue?: string | null;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FieldShell label={label} name={name} help={help} required={required} wide={wide}>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? undefined}
        aria-describedby={help ? `${name}-help` : undefined}
        className={fieldClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Big tappable yes/no choice with an explanation underneath. */
export function CheckboxField({
  label,
  name,
  help,
  defaultChecked,
}: {
  label: string;
  name: string;
  help?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      htmlFor={name}
      className="flex cursor-pointer items-start gap-4 rounded-xl border-2 border-[var(--border)] bg-[var(--background)] p-4 md:col-span-2"
    >
      <input
        id={name}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 shrink-0"
      />
      <span>
        <span className="block text-lg font-semibold text-[var(--foreground)]">{label}</span>
        {help ? <span className="mt-1 block text-base text-[var(--muted)]">{help}</span> : null}
      </span>
    </label>
  );
}

/** Sticky save bar at the bottom of long forms. */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-[var(--border)] bg-[var(--card)]/95 px-4 py-4 backdrop-blur md:mx-0 md:rounded-2xl md:border">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function centsToEuroInput(cents: number | null | undefined): string {
  if (typeof cents !== "number") return "";
  return (cents / 100).toFixed(2);
}
