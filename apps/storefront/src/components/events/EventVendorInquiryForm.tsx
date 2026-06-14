"use client";

import { useState, useTransition } from "react";
import { submitEventVendorInquiryAction } from "@/app/actions/event-vendor-inquiry";
import { Button } from "@/components/ui/button";

type EventVendorInquiryFormProps = {
  eventId: string;
  organizerCreatorId: string;
  eventTitle: string;
};

export function EventVendorInquiryForm({
  eventId,
  organizerCreatorId,
  eventTitle,
}: EventVendorInquiryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-6 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        setError(null);
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await submitEventVendorInquiryAction({
            eventId,
            organizerCreatorId,
            businessName: String(formData.get("business_name") ?? ""),
            contactName: String(formData.get("contact_name") ?? ""),
            email: String(formData.get("email") ?? ""),
            message: String(formData.get("message") ?? ""),
          });
          if (result.ok) {
            setMessage("Bedankt! De organisator ontvangt je aanmelding via Hobbysalon.");
            event.currentTarget.reset();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
          Aanmelden als standhouder
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Interesse om aanwezig te zijn op {eventTitle}? Stuur een aanvraag via Hobbysalon.
        </p>
      </div>

      <label className="block text-sm font-medium">
        Bedrijfsnaam
        <input
          name="business_name"
          required
          className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        Contactpersoon
        <input
          name="contact_name"
          required
          className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        E-mail
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        Bericht (optioneel)
        <textarea
          name="message"
          rows={4}
          className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
        />
      </label>

      {message && (
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Versturen…" : "Aanmelden als standhouder"}
      </Button>
    </form>
  );
}
