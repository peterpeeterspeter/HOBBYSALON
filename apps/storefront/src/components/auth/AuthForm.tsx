"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";

// Login only. New accounts use RegisterForm (/register, /register/creator).
type AuthFormProps = {
  mode: "login";
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
      className="min-h-12 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {pending ? "Aanmelden..." : "Aanmelden"}
    </button>
  );
}

export function AuthForm({ action, nextPath }: AuthFormProps) {
  const [state, formAction] = useActionState(action, {
    success: false,
    message: "",
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      <label className="block">
        <span className="mb-2 block text-base font-semibold text-[var(--foreground)]">
          E-mailadres
        </span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          className="min-h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-base font-semibold text-[var(--foreground)]">
          Wachtwoord
        </span>
        <input
          required
          type="password"
          name="password"
          minLength={8}
          autoComplete="current-password"
          className="min-h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </label>

      {state.message && (
        <p
          role={state.success ? "status" : "alert"}
          className={
            state.success
              ? "rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-base text-green-800"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
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
