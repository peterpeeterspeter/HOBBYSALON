"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import {
  REGISTRATION_COUNTRY_OPTIONS,
  REGISTRATION_DEFAULT_COUNTRY,
  REGISTRATION_INTEREST_OPTIONS,
} from "@/lib/auth/registration-options";

type AuthFormProps = {
  mode: "login" | "register";
  action: (
    prevState: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>;
  nextPath: string;
};

function SubmitButton({ mode }: { mode: "login" | "register" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-60"
    >
      {pending
        ? mode === "login"
          ? "Aanmelden..."
          : "Registreren..."
        : mode === "login"
          ? "Aanmelden"
          : "Account maken"}
    </button>
  );
}

export function AuthForm({ mode, action, nextPath }: AuthFormProps) {
  const [state, formAction] = useActionState(action, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
          E-mailadres
        </span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)]"
          placeholder="naam@voorbeeld.be"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
          Wachtwoord
        </span>
        <input
          required
          type="password"
          name="password"
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)]"
          placeholder="Minimaal 8 karakters"
        />
      </label>

      {mode === "register" && (
        <>
          <fieldset className="space-y-2 rounded-lg border border-[var(--border)] p-3">
            <legend className="px-1 text-sm font-medium text-[var(--foreground)]">
              Interesses
            </legend>
            <p className="text-xs text-[var(--muted)]">
              Kies wat je vooral zoekt op Hobbysalon.
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
                defaultValue={REGISTRATION_DEFAULT_COUNTRY}
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
        </>
      )}

      {state.message && (
        <p
          className={
            state.success
              ? "text-sm text-green-700"
              : "text-sm text-red-700"
          }
        >
          {state.message}
        </p>
      )}

      <SubmitButton mode={mode} />
    </form>
  );
}
