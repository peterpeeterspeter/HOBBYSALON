"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import {
  REGISTRATION_COUNTRY_OPTIONS,
  REGISTRATION_DEFAULT_COUNTRY,
  REGISTRATION_INTEREST_OPTIONS,
  REGISTRATION_OFFER_ROLE_OPTIONS,
  type RegistrationInterestType,
  type RegistrationOfferRole,
} from "@/lib/auth/registration-options";
import { cn } from "@/lib/utils";

export type RegistrationHobbyDomain = {
  id: string;
  slug: string;
  name: string;
};

type RegisterIntentFormProps = {
  action: (
    prevState: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>;
  nextPath: string;
  hobbyDomains?: RegistrationHobbyDomain[];
  loginHref: string;
  /** Campaign preselect: discover | offer | both */
  initialIntent?: "discover" | "offer" | null;
  /** Campaign preselect offer role */
  initialOfferRole?: RegistrationOfferRole | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {pending ? "Account maken..." : "Gratis account maken"}
    </button>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  onChange,
  id,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-[5.5rem] cursor-pointer flex-col justify-center rounded-2xl border px-5 py-4 transition",
        checked
          ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-[var(--shadow-sm)]"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
        {title}
      </span>
      <span className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
        {description}
      </span>
    </label>
  );
}

export function RegisterIntentForm({
  action,
  nextPath,
  hobbyDomains = [],
  loginHref,
  initialIntent = null,
  initialOfferRole = null,
}: RegisterIntentFormProps) {
  const [state, formAction] = useActionState(action, {
    success: false,
    message: "",
  });

  const [wantDiscover, setWantDiscover] = useState(
    initialIntent === "discover" || initialIntent === null
  );
  const [wantOffer, setWantOffer] = useState(
    initialIntent === "offer" || Boolean(initialOfferRole)
  );

  const [selectedInterests, setSelectedInterests] = useState<
    Set<RegistrationInterestType>
  >(new Set());
  const [selectedOfferRoles, setSelectedOfferRoles] = useState<
    Set<RegistrationOfferRole>
  >(() => (initialOfferRole ? new Set([initialOfferRole]) : new Set()));
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<string>>(
    new Set()
  );
  const [allHobbies, setAllHobbies] = useState(false);

  const showHobbyCategories =
    wantDiscover && selectedInterests.has("article") && hobbyDomains.length > 0;

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

  function toggleOfferRole(value: RegistrationOfferRole) {
    setWantOffer(true);
    setSelectedOfferRoles((prev) => {
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
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="next" value={nextPath} />
      {[...selectedOfferRoles].map((role) => (
        <input key={role} type="hidden" name="offer_roles" value={role} />
      ))}

      <section aria-labelledby="register-intent-title">
        <h2
          id="register-intent-title"
          className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]"
        >
          Waarvoor wil je Hobbysalon gebruiken?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Kies alles wat bij jou past. Eén account kan meerdere rollen hebben. Je
          kunt dit later altijd aanpassen.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ToggleCard
            id="intent-discover"
            title="Ik wil ontdekken"
            description="Workshops, makers, evenementen, inspiratie en materialen in je buurt ontdekken."
            checked={wantDiscover}
            onChange={() => setWantDiscover((v) => !v)}
          />
          <ToggleCard
            id="intent-offer"
            title="Ik wil iets aanbieden"
            description="Deel workshops, creaties, evenementen of materialen met hobbyisten."
            checked={wantOffer}
            onChange={() => {
              setWantOffer((v) => {
                const next = !v;
                if (!next) setSelectedOfferRoles(new Set());
                return next;
              });
            }}
          />
        </div>
      </section>

      {wantDiscover ? (
        <fieldset>
          <legend className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
            Ik zoek creatieve inspiratie en activiteiten
          </legend>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Kies één of meer. Dit helpt ons relevante voorstellen te tonen.
          </p>
          <div className="mt-3 grid gap-2">
            {REGISTRATION_INTEREST_OPTIONS.map((interest) => {
              const checked = selectedInterests.has(interest.value);
              return (
                <label
                  key={interest.value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition",
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
                    className="mt-1 size-5 accent-[var(--accent)]"
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
      ) : null}

      {wantOffer ? (
        <fieldset>
          <legend className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
            Wil je zelf iets aanbieden?
          </legend>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Na je gratis account rond je je aanbiedersprofiel af. Je kunt meerdere
            rollen kiezen.
          </p>
          <div className="mt-3 grid gap-2">
            {REGISTRATION_OFFER_ROLE_OPTIONS.map((role) => {
              const checked = selectedOfferRoles.has(role.value);
              return (
                <label
                  key={role.value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition",
                    checked
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOfferRole(role.value)}
                    className="mt-1 size-5 accent-[var(--accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--foreground)]">
                      {role.label}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-[var(--muted)]">
                      {role.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {showHobbyCategories ? (
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
      ) : null}

      <section aria-labelledby="register-account-title" className="space-y-5">
        <div>
          <h2
            id="register-account-title"
            className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]"
          >
            Je account
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Gratis account. Geen abonnement. Je zit nergens aan vast.
          </p>
        </div>

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
            autoComplete="new-password"
            className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            placeholder="Minimaal 8 karakters"
          />
        </label>

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
            <span className="mt-1.5 block text-xs leading-relaxed text-[var(--muted)]">
              We gebruiken je postcode om workshops, makers en evenementen in je
              buurt te tonen.
            </span>
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

        <fieldset className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <legend className="px-1 text-base font-semibold text-[var(--foreground)]">
            Hou me op de hoogte
          </legend>
          <label className="mt-2 flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="marketing_opt_in"
              className="mt-1 size-5 accent-[var(--accent)]"
            />
            <span className="text-sm leading-relaxed text-[var(--foreground)]">
              Stuur mij inspiratie, nieuwe workshops, evenementen en nieuws van
              Hobbysalon.
              <span className="mt-1 block text-[var(--muted)]">
                Niet nodig om een account aan te maken. Je kunt dit later
                uitzetten.
              </span>
            </span>
          </label>
        </fieldset>

        {state.message ? (
          <p
            className={
              state.success
                ? "rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
                : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            }
          >
            {state.message}
          </p>
        ) : null}

        <SubmitButton />

        <p className="text-center text-sm font-medium text-[var(--foreground)]">
          Geen abonnement. Je zit nergens aan vast.
        </p>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Na registratie ontvang je een bevestigingsmail. Bevestig je e-mailadres
          om je account te activeren.
        </p>
        <p className="text-sm text-[var(--muted)]">
          Al een account?{" "}
          <Link
            href={loginHref}
            className="font-medium text-[var(--accent)] underline"
          >
            Meld je aan
          </Link>
          .
        </p>
      </section>
    </form>
  );
}
