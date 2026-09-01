"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";

type Props = {
  action: (
    prevState: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
    >
      {pending ? "Versturen..." : "Stuur resetlink"}
    </button>
  );
}

export function ForgotPasswordForm({ action }: Props) {
  const [state, formAction] = useActionState(action, {
    success: false,
    message: "",
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        Vul je e-mailadres in. Je ontvangt een link om een nieuw wachtwoord te
        kiezen. De link is één uur geldig.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
          E-mailadres
        </span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          placeholder="naam@voorbeeld.be"
        />
      </label>

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

      <TurnstileWidget onTokenChange={setCaptchaToken} />
      <input
        type="hidden"
        name="cf-turnstile-response"
        value={captchaToken ?? ""}
      />

      <SubmitButton />
    </form>
  );
}
