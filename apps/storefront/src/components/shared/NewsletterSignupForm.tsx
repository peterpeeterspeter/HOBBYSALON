"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  subscribeNewsletterAction,
  type NewsletterActionState,
} from "@/app/actions/newsletter";
import { trackEvent } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

const INITIAL_STATE: NewsletterActionState = {
  success: false,
  message: "",
};

function SubscribeButton({ variant }: { variant?: "default" | "footer" }) {
  const { pending } = useFormStatus();
  const isFooter = variant === "footer";

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 min-h-[var(--touch-target-min)]",
        isFooter
          ? "bg-white text-[var(--accent)] hover:bg-white/90"
          : "bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90"
      )}
    >
      {pending ? "Bezig..." : "Inschrijven"}
    </button>
  );
}

type NewsletterSignupFormProps = {
  /** "footer" renders white inputs on terracotta background */
  variant?: "default" | "footer";
};

export function NewsletterSignupForm({ variant = "default" }: NewsletterSignupFormProps) {
  const [state, formAction] = useActionState(
    subscribeNewsletterAction,
    INITIAL_STATE
  );
  const trackedSuccess = useRef(false);
  const isFooter = variant === "footer";

  useEffect(() => {
    if (state.success && !trackedSuccess.current) {
      trackedSuccess.current = true;
      trackEvent("newsletter_signup", {
        signup_source: isFooter ? "footer_form" : "newsletter_form",
      });
    }

    if (!state.success) {
      trackedSuccess.current = false;
    }
  }, [state.success, isFooter]);

  const inputClasses = cn(
    "rounded-lg px-3 py-2.5 text-sm min-h-[var(--touch-target-min)]",
    isFooter
      ? "border border-white/30 bg-white/15 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
      : "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
  );

  return (
    <form action={formAction} className="space-y-3">
      {!isFooter && (
        <p className="text-sm font-medium text-[var(--foreground)]">Nieuwsbrief</p>
      )}

      {/* Primary row: email + submit */}
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="naam@voorbeeld.be"
          className={cn(inputClasses, "min-w-0 flex-1")}
        />
        <SubscribeButton variant={variant} />
      </div>

      {/* Secondary row: optional fields */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          name="first_name"
          placeholder="Voornaam (optioneel)"
          className={cn(inputClasses, "min-w-[140px] flex-1")}
        />
        <input
          type="text"
          name="preferred_city"
          placeholder="Stad (optioneel)"
          className={cn(inputClasses, "min-w-[120px] flex-1")}
        />
        <select
          name="interest_type"
          className={cn(inputClasses, "min-w-[120px]")}
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

      {/* Status message */}
      {state.message && (
        <p
          className={cn(
            "text-xs",
            state.success
              ? isFooter ? "text-white/90" : "text-green-700"
              : isFooter ? "text-yellow-200" : "text-red-700"
          )}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
