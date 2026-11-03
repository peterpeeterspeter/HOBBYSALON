"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  subscribeNewsletterAction,
  type NewsletterActionState,
} from "@/app/actions/newsletter";
import { trackEvent } from "@/lib/analytics/track";
import { newsletterSuccessEvent } from "@/lib/analytics/conversions";
import { cn } from "@/lib/utils";

const INITIAL_STATE: NewsletterActionState = {
  success: false,
  message: "",
};

type FormVariant = "default" | "footer" | "page";

function SubscribeButton({ variant }: { variant?: FormVariant }) {
  const { pending } = useFormStatus();
  const isFooter = variant === "footer";
  const isPage = variant === "page";

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "shrink-0 rounded-lg bg-[var(--accent)] px-6 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60",
        isPage ? "min-h-14 text-lg" : "min-h-12 text-base",
        isFooter ? "focus-visible:ring-white focus-visible:ring-offset-[var(--foreground)]" : "focus-visible:ring-[var(--accent)]"
      )}
    >
      {pending ? "Bezig..." : "Inschrijven"}
    </button>
  );
}

type NewsletterSignupFormProps = {
  /** "footer" = email only on the dark footer; "page" = large senior-friendly controls */
  variant?: FormVariant;
  /** Enables double opt-in and delivery for an active lead-magnet campaign. */
  leadMagnetCode?: string;
  /** Path recorded with the lead-magnet consent event. */
  sourcePath?: string;
};

export function NewsletterSignupForm({
  variant = "default",
  leadMagnetCode,
  sourcePath,
}: NewsletterSignupFormProps) {
  const [state, formAction] = useActionState(
    subscribeNewsletterAction,
    INITIAL_STATE
  );
  const trackedSuccess = useRef(false);
  const isFooter = variant === "footer";
  const isPage = variant === "page";

  useEffect(() => {
    if (state.success && !trackedSuccess.current) {
      trackedSuccess.current = true;
      trackEvent(newsletterSuccessEvent(state.success, leadMagnetCode)!, {
        ...(!leadMagnetCode ? { opt_in_method: "single" } : {}),
        signup_source: leadMagnetCode
          ? "lead_magnet_form"
          : isFooter
            ? "footer_form"
            : "newsletter_form",
        ...(leadMagnetCode ? { lead_magnet_code: leadMagnetCode } : {}),
      });
    }

    if (!state.success) {
      trackedSuccess.current = false;
    }
  }, [state.success, isFooter, leadMagnetCode]);

  const inputClasses = cn(
    "w-full rounded-lg border px-4 focus:outline-none focus:ring-2",
    isPage ? "min-h-14 text-lg" : "min-h-12 text-base",
    isFooter
      ? "border-white/30 bg-white/10 text-white placeholder:text-white/50 focus:ring-white/60"
      : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-[var(--accent)]/50"
  );
  const labelClasses = cn(
    "mb-2 block font-semibold",
    isPage ? "text-lg" : "text-base",
    isFooter ? "text-white" : "text-[var(--foreground)]"
  );
  const ids = {
    email: `${variant}-newsletter-email`,
    firstName: `${variant}-newsletter-first-name`,
    city: `${variant}-newsletter-city`,
    interest: `${variant}-newsletter-interest`,
  };

  return (
    <form action={formAction} className="space-y-4">
      {leadMagnetCode && <input type="hidden" name="lead_magnet_code" value={leadMagnetCode} />}
      {leadMagnetCode && sourcePath && <input type="hidden" name="source_path" value={sourcePath} />}

      <div>
        <label htmlFor={ids.email} className={labelClasses}>
          {isFooter ? "Creatieve inspiratie in je inbox" : "Je e-mailadres"}
        </label>
        <div className={cn("flex gap-3", isPage ? "flex-col sm:flex-row" : "flex-col sm:flex-row")}>
          <input
            id={ids.email}
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="naam@voorbeeld.be"
            className={cn(inputClasses, "min-w-0 flex-1")}
          />
          <SubscribeButton variant={variant} />
        </div>
      </div>

      {/* The footer keeps it to one field; the other forms ask a bit more. */}
      {!isFooter ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={ids.firstName} className={labelClasses}>
              Voornaam <span className="font-normal text-[var(--muted)]">(optioneel)</span>
            </label>
            <input id={ids.firstName} type="text" name="first_name" autoComplete="given-name" className={inputClasses} />
          </div>
          <div>
            <label htmlFor={ids.city} className={labelClasses}>
              Stad <span className="font-normal text-[var(--muted)]">(optioneel)</span>
            </label>
            <input id={ids.city} type="text" name="preferred_city" autoComplete="address-level2" className={inputClasses} />
          </div>
          <div>
            <label htmlFor={ids.interest} className={labelClasses}>
              Interesse <span className="font-normal text-[var(--muted)]">(optioneel)</span>
            </label>
            <select id={ids.interest} name="interest_type" className={inputClasses} defaultValue="">
              <option value="">Alles</option>
              <option value="workshop">Workshops</option>
              <option value="handmade">Zelfgemaakt werk</option>
              <option value="supply">Benodigdheden</option>
              <option value="event">Events</option>
              <option value="article">Artikelen</option>
            </select>
          </div>
        </div>
      ) : null}

      <p className={cn(isPage ? "text-base" : "text-sm", isFooter ? "text-white/60" : "text-[var(--muted)]")}>
        Gratis. Je kunt je op elk moment weer uitschrijven.
      </p>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          isPage ? "text-base" : "text-sm",
          !state.message && "sr-only",
          state.success
            ? isFooter ? "text-white" : "text-green-700"
            : isFooter ? "text-yellow-200" : "text-red-700"
        )}
      >
        {state.message}
      </p>
    </form>
  );
}
