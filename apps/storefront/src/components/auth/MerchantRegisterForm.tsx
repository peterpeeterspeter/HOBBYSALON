"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import {
  REGISTRATION_COUNTRY_OPTIONS,
  REGISTRATION_DEFAULT_COUNTRY,
  REGISTRATION_INTEREST_OPTIONS,
} from "@/lib/auth/registration-options";

type MerchantRegisterFormProps = {
  action: (
    prevState: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>;
  nextPath: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
    >
      {pending ? "Merchant-account maken..." : "Merchant-account maken"}
    </button>
  );
}

export function MerchantRegisterForm({
  action,
  nextPath,
}: MerchantRegisterFormProps) {
  const [state, formAction] = useActionState(action, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
          Handelsnaam
        </span>
        <input
          required
          type="text"
          name="display_name"
          maxLength={120}
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="Bijv. HobbyShop Antwerpen"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
          Contactpersoon (optioneel)
        </span>
        <input
          type="text"
          name="contact_name"
          maxLength={120}
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="Voor- en achternaam"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
          E-mailadres
        </span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
          autoComplete="new-password"
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="Minimaal 8 karakters"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            Telefoon (optioneel)
          </span>
          <input
            type="text"
            name="phone"
            maxLength={32}
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            placeholder="+32 ..."
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            Stad (optioneel)
          </span>
          <input
            type="text"
            name="city"
            maxLength={80}
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            placeholder="Antwerpen"
          />
        </label>
      </div>

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
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          >
            {REGISTRATION_COUNTRY_OPTIONS.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <legend className="px-1 text-sm font-medium text-[var(--foreground)]">
          Interesses
        </legend>
        <div className="flex flex-wrap gap-2">
          {REGISTRATION_INTEREST_OPTIONS.map((interest) => (
            <label
              key={interest.value}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="interest_types"
                value={interest.value}
                defaultChecked={interest.value === "supply"}
              />
              <span>{interest.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.message && (
        <p
          className={
            state.success ? "text-sm text-green-700" : "text-sm text-red-700"
          }
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
