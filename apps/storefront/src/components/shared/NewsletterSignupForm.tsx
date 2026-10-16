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
        "rounded-lg px-5 font-semibold transition-colors disabled:opacity-60",
        isPage
          ? "min-h-14 px-6 text-lg"
          : "min-h-[var(--touch-target-min)] py-2.5 text-sm",
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
  /** "footer" = white on terracotta; "page" = large senior-friendly controls */
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
    "rounded-lg px-3",
    isPage
      ? "min-h-14 px-4 text-lg"
      : "min-h-[var(--touch-target-min)] py-2.5 text-sm",
    isFooter
      ? "border border-white/30 bg-white/15 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
      : "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
  );

  return (
    <form action={formAction} className="space-y-3">
      {leadMagnetCode && <input type="hidden" name="lead_magnet_code" value={leadMagnetCode} />}
      {leadMagnetCode && sourcePath && <input type="hidden" name="source_path" value={sourcePath} />}
      {!isFooter && (
        <p
          className={cn(
            "font-medium text-[var(--foreground)]",
            isPage ? "text-lg" : "text-sm"
          )}
        >
          Nieuwsbrief
        </p>
      )}

      {/* Primary row: email + submit */}
      <div className={cn("flex gap-2", isPage && "flex-col sm:flex-row")}>
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
            isPage ? "text-base" : "text-xs",
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
