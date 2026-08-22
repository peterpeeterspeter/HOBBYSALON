"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

export type FormDraftData = Record<string, string | string[] | boolean>;

type FormWithDraftProps = {
  storageKey: string;
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode | ((ctx: { draft: FormDraftData | null }) => ReactNode);
  className?: string;
  encType?: string;
};

const SKIP_FIELD_TYPES = new Set(["file", "button", "submit", "reset", "image"]);

function readDraft(storageKey: string): FormDraftData | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraftData;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeDraft(storageKey: string, form: HTMLFormElement): void {
  const data: FormDraftData = {};
  const elements = Array.from(form.elements);

  for (const element of elements) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement) &&
      !(element instanceof HTMLSelectElement)
    ) {
      continue;
    }

    const name = element.name;
    if (!name) continue;

    if (element instanceof HTMLInputElement) {
      if (SKIP_FIELD_TYPES.has(element.type)) continue;
      if (element.type === "checkbox") {
        if (!element.checked) continue;
        const existing = data[name];
        if (existing === undefined) {
          data[name] = element.value || "on";
        } else if (Array.isArray(existing)) {
          existing.push(element.value || "on");
        } else {
          data[name] = [String(existing), element.value || "on"];
        }
        continue;
      }
      if (element.type === "radio") {
        if (element.checked) data[name] = element.value;
        continue;
      }
    }

    const value = element.value;
    const existing = data[name];
    if (existing === undefined) {
      data[name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      data[name] = [String(existing), value];
    }
  }

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // Quota / private mode — ignore.
  }
}

function applyDraftToForm(form: HTMLFormElement, draft: FormDraftData): void {
  for (const [name, value] of Object.entries(draft)) {
    const field = form.elements.namedItem(name);
    if (!field) continue;

    const values = Array.isArray(value) ? value.map(String) : [String(value)];

    if (field instanceof RadioNodeList) {
      for (const node of Array.from(field)) {
        if (!(node instanceof HTMLInputElement)) continue;
        if (node.type === "checkbox" || node.type === "radio") {
          node.checked = values.includes(node.value) || values.includes("on");
        } else {
          node.value = values[0] ?? "";
        }
      }
      continue;
    }

    if (field instanceof HTMLInputElement) {
      if (field.type === "checkbox") {
        field.checked =
          values.includes(field.value) ||
          values.includes("on") ||
          value === true;
      } else if (field.type === "radio") {
        field.checked = values.includes(field.value);
      } else if (!SKIP_FIELD_TYPES.has(field.type)) {
        field.value = values[0] ?? "";
      }
      continue;
    }

    if (
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement
    ) {
      field.value = values[0] ?? "";
    }
  }
}

export function draftString(
  draft: FormDraftData | null,
  key: string
): string | undefined {
  const value = draft?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export function draftStringArray(
  draft: FormDraftData | null,
  key: string
): string[] {
  const value = draft?.[key];
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/**
 * Persists form field values in sessionStorage so a session timeout / re-login
 * does not wipe a long product (or other) listing form.
 */
export function FormWithDraft({
  storageKey,
  action,
  children,
  className,
  encType,
}: FormWithDraftProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const appliedRef = useRef(false);
  const [draft, setDraft] = useState<FormDraftData | null>(null);
  const [showRestored, setShowRestored] = useState(false);
  const bannerId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      sessionStorage.removeItem(storageKey);
      return;
    }
    const saved = readDraft(storageKey);
    if (!saved) return;
    setDraft(saved);
    setShowRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!draft || !formRef.current || appliedRef.current) return;
    applyDraftToForm(formRef.current, draft);
    appliedRef.current = true;
  }, [draft]);

  function persistCurrent() {
    if (formRef.current) writeDraft(storageKey, formRef.current);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    writeDraft(storageKey, event.currentTarget);
  }

  return (
    <>
      {showRestored ? (
        <p
          id={bannerId}
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          Je eerdere invoer is hersteld. Controleer alles en klik opnieuw op
          opslaan.
        </p>
      ) : null}
      <form
        ref={formRef}
        className={className}
        encType={encType}
        action={action}
        onInput={persistCurrent}
        onChange={persistCurrent}
        onSubmit={handleSubmit}
        aria-describedby={showRestored ? bannerId : undefined}
      >
        {typeof children === "function" ? children({ draft }) : children}
      </form>
    </>
  );
}
