"use client";

import { useState, type FormEvent } from "react";

type OrderHelpProps = {
  orderSetId: string;
  supportEmail?: string;
};

/**
 * Order-linked help entry (EC15). Captures a return/support request intent.
 * Refunds must go through the real refund/reversal path — this UI never
 * claims a Stripe refund completed.
 */
export function OrderHelp({
  orderSetId,
  supportEmail = "info@hobbysalon.be",
}: OrderHelpProps) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const subject = encodeURIComponent(`Hulp bij bestelling ${orderSetId}`);
    const body = encodeURIComponent(
      `Bestelling: ${orderSetId}\n\nReden / vraag:\n${reason.trim()}\n\n(Status: aanvraag — nog geen terugbetaling uitgevoerd.)`
    );
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  return (
    <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="text-base font-semibold text-[var(--foreground)]">
        Hulp of retour
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Stuur een verzoek. Een terugbetaling zie je pas nadat die echt is
        verwerkt — dit formulier betaalt niet automatisch terug.
      </p>
      {submitted ? (
        <p className="mt-3 text-sm text-green-700">
          Je e-mailprogramma opent met je verzoek. Status blijft &quot;aangevraagd&quot;
          tot support de retour of terugbetaling afrondt.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Wat is er aan de hand?</span>
            <textarea
              required
              minLength={10}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Bijv. artikel beschadigd, verkeerde maat, vraag over tracking…"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)]"
          >
            Verzoek versturen
          </button>
        </form>
      )}
    </section>
  );
}
