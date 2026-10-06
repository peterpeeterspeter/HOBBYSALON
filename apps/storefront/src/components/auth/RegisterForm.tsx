"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import type { RegistrationOfferRole } from "@/lib/auth/registration-options";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";

type RegisterFormProps = {
  action: (
    prevState: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>;
  nextPath: string;
  loginHref: string;
  /** Aanbieder signups: sent as offer_roles so registerAction routes to /onboarding. */
  offerRole?: Exclude<RegistrationOfferRole, "merchant"> | null;
  submitLabel?: string;
};

const inputClass =
  "min-h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";
const labelClass =
  "mb-2 block text-base font-semibold text-[var(--foreground)]";
const hintClass = "mt-2 block text-sm leading-relaxed text-[var(--muted)]";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] active:scale-[0.99] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {pending ? "Even geduld..." : label}
    </button>
  );
}

export function RegisterForm({
  action,
  nextPath,
  loginHref,
  offerRole = null,
  submitLabel = "Gratis account maken",
}: RegisterFormProps) {
  const [state, formAction] = useActionState(action, {
    success: false,
    message: "",
  });
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Replace the form after success so nobody presses again and burns the
  // hourly confirmation-mail limit.
  if (state.success) {
    return (
      <div role="status" className="space-y-3">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
          Kijk in je mailbox
        </h2>
        <p className="text-lg leading-relaxed text-[var(--foreground)]">
          We stuurden een bevestigingsmail naar{" "}
          <strong className="break-all">{email}</strong>. Klik op de knop in
          die mail om je account te activeren.
        </p>
        <p className="text-base leading-relaxed text-[var(--muted)]">
          Niets ontvangen? Kijk ook bij Spam of Ongewenst.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="next" value={nextPath} />
      {offerRole ? (
        <input type="hidden" name="offer_roles" value={offerRole} />
      ) : null}

      <label className="block">
        <span className={labelClass}>E-mailadres</span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
        />
      </label>

      <div>
        <label htmlFor="register-password" className={labelClass}>
          Wachtwoord
        </label>
        <div className="flex gap-2">
          <input
            id="register-password"
            required
            type={showPassword ? "text" : "password"}
            name="password"
            minLength={8}
            autoComplete="new-password"
            aria-describedby="register-password-hint"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-pressed={showPassword}
            aria-controls="register-password"
            className="min-h-12 shrink-0 rounded-xl border border-[var(--border-strong)] bg-[var(--background)] px-4 text-base font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {showPassword ? "Verberg" : "Toon"}
          </button>
        </div>
        <span id="register-password-hint" className={hintClass}>
          Minstens 8 tekens.
        </span>
      </div>

      <label className="block">
        <span className={labelClass}>
          Postcode{" "}
          <span className="font-normal text-[var(--muted)]">(optioneel)</span>
        </span>
        <input
          type="text"
          name="postal_code"
          maxLength={16}
          autoComplete="postal-code"
          className={`${inputClass} max-w-[12rem]`}
        />
        <span className={hintClass}>
          Dan tonen we workshops en evenementen in je buurt.
        </span>
      </label>

      <label className="flex min-h-12 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="marketing_opt_in"
          className="mt-1 size-6 shrink-0 accent-[var(--accent)]"
        />
        <span className="text-base leading-relaxed text-[var(--foreground)]">
          Stuur mij af en toe inspiratie en nieuws. Je kunt dit altijd
          uitzetten.
        </span>
      </label>

      {state.message ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
        >
          {state.message}
        </p>
      ) : null}

      <TurnstileWidget onTokenChange={setCaptchaToken} />
      <input
        type="hidden"
        name="cf-turnstile-response"
        value={captchaToken ?? ""}
      />

      <SubmitButton label={submitLabel} />

      <p className="text-base leading-relaxed text-[var(--muted)]">
        Gratis, geen abonnement. Al een account?{" "}
        <Link
          href={loginHref}
          className="font-semibold text-[var(--accent)] underline underline-offset-4"
        >
          Meld je aan
        </Link>
        .
      </p>
    </form>
  );
}
