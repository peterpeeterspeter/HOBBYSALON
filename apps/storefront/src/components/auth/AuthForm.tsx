"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import {
  REGISTRATION_COUNTRY_OPTIONS,
  REGISTRATION_DEFAULT_COUNTRY,
  REGISTRATION_INTEREST_OPTIONS,
  type RegistrationInterestType,
} from "@/lib/auth/registration-options";
import { cn } from "@/lib/utils";

export type RegistrationHobbyDomain = {
  id: string;
  slug: string;
  name: string;
};

type AuthFormProps = {
  mode: "login" | "register";
  action: (
    prevState: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>;
  nextPath: string;
  hobbyDomains?: RegistrationHobbyDomain[];
};

function SubmitButton({ mode }: { mode: "login" | "register" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {pending
        ? mode === "login"
          ? "Aanmelden..."
          : "Account maken..."
        : mode === "login"
          ? "Aanmelden"
          : "Gratis hobbyistenaccount maken"}
    </button>
  );
}

export function AuthForm({
  mode,
  action,
  nextPath,
  hobbyDomains = [],
}: AuthFormProps) {
  const [state, formAction] = useActionState(action, {
    success: false,
    message: "",
  });
  const [selectedInterests, setSelectedInterests] = useState<
    Set<RegistrationInterestType>
  >(new Set());
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<string>>(
    new Set()
  );
  const [allHobbies, setAllHobbies] = useState(false);

  const showHobbyCategories =
    mode === "register" && selectedInterests.has("article");

  const domainIds = useMemo(
    () => hobbyDomains.map((domain) => domain.id),
    [hobbyDomains]
  );

  function toggleInterest(value: RegistrationInterestType) {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleDomain(domainId: string) {
    setAllHobbies(false);
    setSelectedDomainIds((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) next.delete(domainId);
      else next.add(domainId);
      return next;
    });
  }

  function selectAllHobbies() {
    setAllHobbies(true);
    setSelectedDomainIds(new Set(domainIds));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      {mode === "register" && (
        <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--section-highlight)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--accent)]">
            Voor hobbyisten
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            Maak een gratis account om inspiratie te bewaren, projecten te starten
            en workshops of materialen dichterbij te vinden.
          </p>
        </div>
      )}

      {mode === "register" && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">
          Na registratie sturen we een bevestigingsmail. Je kunt pas inloggen
          nadat je je e-mailadres hebt bevestigd.
        </p>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
          E-mailadres
        </span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="naam@voorbeeld.be"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
          Wachtwoord
        </span>
        <input
          required
          type="password"
          name="password"
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="Minimaal 8 karakters"
        />
      </label>

      {mode === "register" && (
        <>
          <fieldset>
            <legend className="text-base font-semibold text-[var(--foreground)]">
              Wat zoek je vooral?
            </legend>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Kies één of meer. Je kunt dit later altijd wijzigen.
            </p>
            <div className="mt-3 grid gap-2">
              {REGISTRATION_INTEREST_OPTIONS.map((interest) => {
                const checked = selectedInterests.has(interest.value);
                return (
                  <label
                    key={interest.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition",
                      checked
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"
                    )}
                  >
                    <input
                      type="checkbox"
                      name="interest_types"
                      value={interest.value}
                      checked={checked}
                      onChange={() => toggleInterest(interest.value)}
                      className="mt-1 h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">
                        {interest.label}
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-[var(--muted)]">
                        {interest.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {showHobbyCategories && hobbyDomains.length > 0 && (
            <fieldset className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <legend className="px-1 text-base font-semibold text-[var(--foreground)]">
                Hobbycategorie
              </legend>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Welke hobby&apos;s mag je inspiratie vooral over gaan?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllHobbies}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition",
                    allHobbies
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)]"
                  )}
                >
                  Alle hobby&apos;s
                </button>
                {hobbyDomains.map((domain) => {
                  const checked = selectedDomainIds.has(domain.id);
                  return (
                    <label
                      key={domain.id}
                      className={cn(
                        "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition",
                        checked && !allHobbies
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : allHobbies
                            ? "border-[var(--accent)]/40 bg-[var(--accent)]/5 text-[var(--accent)]"
                            : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)]"
                      )}
                    >
                      <input
                        type="checkbox"
                        name="preferred_domain_ids"
                        value={domain.id}
                        checked={checked}
                        onChange={() => toggleDomain(domain.id)}
                        className="sr-only"
                      />
                      {domain.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Postcode
              </span>
              <input
                type="text"
                name="postal_code"
                maxLength={16}
                autoComplete="postal-code"
                className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                placeholder="Bijv. 2800"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Land
              </span>
              <select
                name="country_code"
                defaultValue={REGISTRATION_DEFAULT_COUNTRY}
                className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
              ? "rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          }
        >
          {state.message}
        </p>
      )}

      <SubmitButton mode={mode} />
    </form>
  );
}
