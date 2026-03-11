"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  subscribeNewsletterAction,
  type NewsletterActionState,
} from "@/app/actions/newsletter";
import { trackEvent } from "@/lib/analytics/track";

const INITIAL_STATE: NewsletterActionState = {
  success: false,
  message: "",
};

function SubscribeButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Bezig..." : "Inschrijven"}
    </button>
  );
}

export function NewsletterSignupForm() {
  const [state, formAction] = useActionState(
    subscribeNewsletterAction,
    INITIAL_STATE
  );
  const trackedSuccess = useRef(false);

  useEffect(() => {
    if (state.success && !trackedSuccess.current) {
      trackedSuccess.current = true;
      trackEvent("newsletter_signup", {
        signup_source: "footer_form",
      });
    }

    if (!state.success) {
      trackedSuccess.current = false;
    }
  }, [state.success]);

  return (
    <form action={formAction} className="space-y-2">
      <p className="text-sm font-medium text-[var(--foreground)]">Nieuwsbrief</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="naam@voorbeeld.be"
          className="min-w-56 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
        />
        <SubscribeButton />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          name="first_name"
          placeholder="Voornaam (optioneel)"
          className="min-w-40 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
        />
        <input
          type="text"
          name="preferred_city"
          placeholder="Stad (optioneel)"
          className="min-w-32 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
        />
        <select
          name="interest_type"
          className="min-w-32 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
          defaultValue=""
        >
          <option value="">Interesse</option>
          <option value="workshop">Workshops</option>
          <option value="handmade">Handmade</option>
          <option value="supply">Benodigdheden</option>
          <option value="event">Events</option>
          <option value="article">Artikelen</option>
        </select>
      </div>
      {state.message && (
        <p
          className={
            state.success
              ? "text-xs text-green-700"
              : "text-xs text-red-700"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
