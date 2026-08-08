"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import {
  REGISTRATION_COUNTRY_OPTIONS,
  REGISTRATION_DEFAULT_COUNTRY,
} from "@/lib/auth/registration-options";

type MerchantUpgradeFormProps = {
  action: (
    prevState: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>;
  nextPath: string;
  defaultEmail: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
    >
      {pending ? "Merchant-profiel activeren..." : "Merchant-profiel activeren"}
    </button>
  );
}

export function MerchantUpgradeForm({
  action,
  nextPath,
  defaultEmail,
}: MerchantUpgradeFormProps) {
  const [state, formAction] = useActionState(action, {
    success: false,
    message: "",
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
          Account e-mail
        </span>
        <input
          type="email"
          value={defaultEmail}
          disabled
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-base text-[var(--muted)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
          Handelsnaam
        </span>
        <input
          required
          type="text"
          name="display_name"
          maxLength={120}
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="Bijv. HobbyShop Antwerpen"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
          Contactpersoon
        </span>
        <input
          required
          type="text"
          name="contact_name"
          maxLength={120}
          className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="Voor- en achternaam"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            Telefoon
          </span>
          <input
            required
            type="tel"
            name="phone"
            maxLength={32}
            autoComplete="tel"
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            placeholder="+32 ..."
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            Stad
          </span>
          <input
            required
            type="text"
            name="city"
            maxLength={80}
            autoComplete="address-level2"
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
            className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
