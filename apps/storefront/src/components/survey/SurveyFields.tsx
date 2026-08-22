"use client";

import type { SurveyQuestion } from "@/lib/survey/aanbod-verbeteren";

type BaseProps = {
  question: SurveyQuestion;
  disabled?: boolean;
};

type SingleProps = BaseProps & {
  value: string;
  otherValue?: string;
  onChange: (value: string) => void;
  onOtherChange?: (value: string) => void;
};

type MultiProps = BaseProps & {
  values: string[];
  otherValue?: string;
  onChange: (values: string[]) => void;
  onOtherChange?: (value: string) => void;
};

type ScaleProps = BaseProps & {
  value: string;
  onChange: (value: string) => void;
};

type TextProps = BaseProps & {
  value: string;
  onChange: (value: string) => void;
};

function FieldLabel({ question }: { question: SurveyQuestion }) {
  return (
    <div className="mb-3">
      <p className="text-base font-semibold text-[var(--foreground)]">
        {question.label}
        {question.required ? " *" : question.kind === "textarea" || question.kind === "text" ? " (optioneel)" : null}
      </p>
      {question.helper ? (
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{question.helper}</p>
      ) : null}
      {question.maxSelections ? (
        <p className="mt-1 text-sm text-[var(--muted)]">Maximaal {question.maxSelections} antwoorden.</p>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base text-[var(--foreground)] disabled:opacity-60";

const optionClass =
  "flex min-h-[var(--touch-target-min)] cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-base text-[var(--foreground)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent)]/5";

export function SurveySingleField({
  question,
  value,
  otherValue = "",
  onChange,
  onOtherChange,
  disabled,
}: SingleProps) {
  const otherOption = question.options?.find((option) => option.other);

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <FieldLabel question={question} />
      <div className="space-y-2">
        {question.options?.map((option) => (
          <label key={option.value} className={optionClass}>
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {otherOption && value === otherOption.value ? (
        <input
          type="text"
          value={otherValue}
          onChange={(event) => onOtherChange?.(event.target.value)}
          className={`${inputClass} mt-3`}
          placeholder="Licht kort toe…"
          disabled={disabled}
        />
      ) : null}
    </fieldset>
  );
}

export function SurveyMultiField({
  question,
  values,
  otherValue = "",
  onChange,
  onOtherChange,
  disabled,
}: MultiProps) {
  const max = question.maxSelections;
  const otherOption = question.options?.find((option) => option.other);

  function toggle(optionValue: string) {
    if (values.includes(optionValue)) {
      onChange(values.filter((item) => item !== optionValue));
      return;
    }
    if (max && values.length >= max) return;
    onChange([...values, optionValue]);
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <FieldLabel question={question} />
      <div className="space-y-2">
        {question.options?.map((option) => {
          const checked = values.includes(option.value);
          const atMax = Boolean(max && values.length >= max && !checked);
          return (
            <label
              key={option.value}
              className={`${optionClass}${atMax ? " opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={atMax}
                onChange={() => toggle(option.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {otherOption && values.includes(otherOption.value) ? (
        <input
          type="text"
          value={otherValue}
          onChange={(event) => onOtherChange?.(event.target.value)}
          className={`${inputClass} mt-3`}
          placeholder="Licht kort toe…"
          disabled={disabled}
        />
      ) : null}
    </fieldset>
  );
}

export function SurveyScaleField({ question, value, onChange, disabled }: ScaleProps) {
  const min = question.scaleMin ?? 1;
  const max = question.scaleMax ?? 5;

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <FieldLabel question={question} />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: max - min + 1 }, (_, index) => {
          const scaleValue = String(min + index);
          const selected = value === scaleValue;
          return (
            <button
              key={scaleValue}
              type="button"
              onClick={() => onChange(scaleValue)}
              className={`min-h-[var(--touch-target-min)] min-w-[3rem] rounded-lg border px-4 text-base font-semibold transition-colors ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)]/40"
              }`}
            >
              {scaleValue}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-[var(--muted)]">
        <span>{question.scaleMinLabel}</span>
        <span>{question.scaleMaxLabel}</span>
      </div>
    </fieldset>
  );
}

export function SurveyTextField({ question, value, onChange, disabled }: TextProps) {
  return (
    <div>
      <FieldLabel question={question} />
      <input
        type={question.id === "contact_email" ? "email" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        placeholder={question.placeholder}
        disabled={disabled}
      />
    </div>
  );
}

export function SurveyTextareaField({ question, value, onChange, disabled }: TextProps) {
  return (
    <div>
      <FieldLabel question={question} />
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} min-h-32 resize-y`}
        placeholder={question.placeholder}
        disabled={disabled}
      />
    </div>
  );
}

export function SurveyQuestionField({
  question,
  value,
  otherValue,
  onSingleChange,
  onMultiChange,
  onOtherChange,
  disabled,
}: {
  question: SurveyQuestion;
  value: unknown;
  otherValue?: string;
  onSingleChange: (value: string) => void;
  onMultiChange: (values: string[]) => void;
  onOtherChange?: (value: string) => void;
  disabled?: boolean;
}) {
  switch (question.kind) {
    case "single":
      return (
        <SurveySingleField
          question={question}
          value={typeof value === "string" ? value : ""}
          otherValue={otherValue}
          onChange={onSingleChange}
          onOtherChange={onOtherChange}
          disabled={disabled}
        />
      );
    case "multi":
      return (
        <SurveyMultiField
          question={question}
          values={Array.isArray(value) ? (value as string[]) : []}
          otherValue={otherValue}
          onChange={onMultiChange}
          onOtherChange={onOtherChange}
          disabled={disabled}
        />
      );
    case "scale":
      return (
        <SurveyScaleField
          question={question}
          value={typeof value === "string" ? value : ""}
          onChange={onSingleChange}
          disabled={disabled}
        />
      );
    case "text":
      return (
        <SurveyTextField
          question={question}
          value={typeof value === "string" ? value : ""}
          onChange={onSingleChange}
          disabled={disabled}
        />
      );
    case "textarea":
      return (
        <SurveyTextareaField
          question={question}
          value={typeof value === "string" ? value : ""}
          onChange={onSingleChange}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}
