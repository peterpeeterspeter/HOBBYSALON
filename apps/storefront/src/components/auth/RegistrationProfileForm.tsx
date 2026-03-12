"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import {
  REGISTRATION_COUNTRY_OPTIONS,
  REGISTRATION_DEFAULT_COUNTRY,
  REGISTRATION_INTEREST_OPTIONS,
  type RegistrationInterestType,
} from "@/lib/auth/registration-options";

type RegistrationProfileFormProps = {
  action: (
    prevState: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>;
  nextPath: string;
  defaultPostalCode?: string | null;
  defaultCountryCode?: string | null;
  defaultInterests?: RegistrationInterestType[];
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Voorkeuren opslaan..." : "Voorkeuren opslaan"}
    </button>
  );
}

export function RegistrationProfileForm({
  action,
  nextPath,
  defaultPostalCode,
  defaultCountryCode,
  defaultInterests,
}: RegistrationProfileFormProps) {
  const [state, formAction] = useActionState(action, {
    success: false,
    message: "",
  });

  const selectedInterests = new Set(defaultInterests ?? []);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <fieldset className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <legend className="px-1 text-sm font-medium text-[var(--foreground)]">
          Interesses
        </legend>
        <p className="text-xs text-[var(--muted)]">
          Kies wat je vooral wil ontdekken op Hobbysalon.
        </p>
        <div className="flex flex-wrap gap-2">
          {REGISTRATION_INTEREST_OPTIONS.map((interest) => (
            <label
              key={interest.value}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                name="interest_types"
                value={interest.value}
                defaultChecked={selectedInterests.has(interest.value)}
              />
              <span>{interest.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            Postcode
          </span>
          <input
            type="text"
            name="postal_code"
            maxLength={16}
            autoComplete="postal-code"
            defaultValue={defaultPostalCode ?? ""}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)]"
            placeholder="Bijv. 2800"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            Land
          </span>
          <select
            name="country_code"
            defaultValue={defaultCountryCode ?? REGISTRATION_DEFAULT_COUNTRY}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)]"
          >
            {REGISTRATION_COUNTRY_OPTIONS.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.message && (
        <p className={state.success ? "text-sm text-green-700" : "text-sm text-red-700"}>
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
