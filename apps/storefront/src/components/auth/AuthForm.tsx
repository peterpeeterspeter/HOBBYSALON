"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";

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
