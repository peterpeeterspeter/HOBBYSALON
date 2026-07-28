"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  cancelEventStandhouderRsvpAction,
  rsvpEventStandhouderAction,
} from "@/app/actions/event-standhouder-rsvp";
import { Button } from "@/components/ui/button";

type EventStandhouderRsvpCardProps = {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  isLoggedIn: boolean;
  hasCreatorProfile: boolean;
  isEligible: boolean;
  hasRsvped: boolean;
};

export function EventStandhouderRsvpCard({
  eventId,
  eventSlug,
  eventTitle,
  isLoggedIn,
  hasCreatorProfile,
  isEligible,
  hasRsvped: initialHasRsvped,
}: EventStandhouderRsvpCardProps) {
  const [isPending, startTransition] = useTransition();
  const [hasRsvped, setHasRsvped] = useState(initialHasRsvped);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loginHref = `/login?next=${encodeURIComponent(`/agenda/${eventSlug}`)}`;

  return (
    <div
      id="standhouders"
      className="mt-6 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
          Aanwezig als standhouder?
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Makers en workshopgevers kunnen hier hun aanwezigheid op {eventTitle}{" "}
          bevestigen. Je verschijnt dan op de eventpagina met je producten, en op
          je makerprofiel.
        </p>
      </div>

      {!isLoggedIn ? (
        <Button asChild>
          <Link href={loginHref}>Aanmelden om te RSVP’en</Link>
        </Button>
      ) : !hasCreatorProfile ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Maak eerst een makerprofiel aan. Daarna kun je je als standhouder
            bevestigen.
          </p>
          <Button asChild variant="secondary">
            <Link href="/profile?tab=profiel#maker-pagina">Makerprofiel aanmaken</Link>
          </Button>
        </div>
      ) : !isEligible ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Alleen makers en workshopgevers kunnen RSVP’en als standhouder. Pas je
            rollen aan onder Account.
          </p>
          <Button asChild variant="secondary">
            <Link href="/dashboard/account">Rollen bekijken</Link>
          </Button>
        </div>
      ) : hasRsvped ? (
        <div className="space-y-3">
          <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
            Je staat hier bevestigd als standhouder.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              setMessage(null);
              setError(null);
              startTransition(async () => {
                const result = await cancelEventStandhouderRsvpAction({ eventId });
                if (result.ok) {
                  setHasRsvped(false);
                  setMessage("Je RSVP is geannuleerd.");
                } else {
                  setError(result.error);
                }
              });
            }}
          >
            {isPending ? "Bezig…" : "Annuleer RSVP"}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            setMessage(null);
            setError(null);
            startTransition(async () => {
              const result = await rsvpEventStandhouderAction({ eventId });
              if (result.ok) {
                setHasRsvped(true);
                setMessage("Bedankt! Je bent bevestigd als standhouder.");
              } else {
                setError(result.error);
              }
            });
          }}
        >
          {isPending ? "Bezig…" : "Ik sta hier als standhouder"}
        </Button>
      )}

      {message ? (
        <p className="text-sm text-green-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
