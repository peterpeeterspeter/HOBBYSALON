"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

async function getConfirmationTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return null;
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

export default function ConfirmAccountPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    const confirmAccount = async () => {
      const tokens = await getConfirmationTokens();
      if (!tokens) {
        setError(
          "Deze bevestigingslink is ongeldig of verlopen. Vraag een nieuwe bevestigingsmail aan."
        );
        return;
      }

      const query = new URLSearchParams(window.location.search);
      query.delete("code");
      const queryNext = safeNextPath(query.get("next"));
      const sanitizedQuery = query.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${sanitizedQuery ? `?${sanitizedQuery}` : ""}`
      );

      const response = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tokens),
      });

      if (!response.ok) {
        setError(
          "Je account kon niet worden bevestigd. Vraag een nieuwe bevestigingsmail aan."
        );
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        next?: unknown;
      } | null;
      const nextPath =
        typeof payload?.next === "string"
          ? safeNextPath(payload.next)
          : queryNext;
      router.replace(nextPath);
      router.refresh();
    };

    void confirmAccount();
  }, [router]);

  const resendConfirmation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResendMessage(null);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      setResendMessage("Er ging iets mis. Probeer het later opnieuw.");
      return;
    }

    const redirectTo = new URL("/auth/confirm", window.location.origin).toString();

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: resendEmail,
      options: { emailRedirectTo: redirectTo },
    });

    setResendMessage(
      resendError
        ? "De e-mail kon niet opnieuw worden verstuurd. Probeer het later opnieuw."
        : "Als er een onbevestigd account bestaat voor dit e-mailadres, ontvang je zo een nieuwe bevestigingsmail."
    );
  };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold">Account bevestigen</h1>
        <p className="mt-4 text-neutral-600">
          {error ?? "Je bevestiging wordt verwerkt..."}
        </p>
        {error && (
          <form onSubmit={resendConfirmation} className="mt-6 space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Of{" "}
              <a href="/wachtwoord-vergeten" className="font-semibold text-[var(--accent)] underline">
                vraag een nieuwe wachtwoordlink aan
              </a>
              .
            </p>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                E-mailadres
              </span>
              <input
                required
                type="email"
                autoComplete="email"
                value={resendEmail}
                onChange={(event) => setResendEmail(event.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)]"
                placeholder="naam@voorbeeld.be"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent-foreground)] hover:opacity-90"
            >
              Nieuwe bevestigingsmail sturen
            </button>
            {resendMessage && (
              <p className="text-sm text-[var(--muted)]">{resendMessage}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
