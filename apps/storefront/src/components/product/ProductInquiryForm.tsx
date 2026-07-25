"use client";

import { useState } from "react";
import { submitListingInquiry } from "@/app/actions/listing-inquiry";
import { trackEvent } from "@/lib/analytics/track";

type Props = {
  productId: string;
  creatorId: string;
};

export function ProductInquiryForm({ productId, creatorId }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleSubmit(formData: FormData) {
    setStatus("loading");
    setErrorMessage("");

    const result = await submitListingInquiry(
      "product",
      productId,
      creatorId,
      formData
    );

    if (result.success) {
      trackEvent("listing_inquiry_submitted", {
        entity_type: "product",
        entity_id: productId,
        creator_id: creatorId,
      });
      setStatus("success");
    } else {
      setStatus("error");
      setErrorMessage(result.message ?? "Er is iets misgegaan.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">
          Aanvraag verstuurd
        </h3>
        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
          De maker neemt zo snel mogelijk contact met je op.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="full_name"
          className="mb-1 block text-sm font-medium text-[var(--foreground)]"
        >
          Naam *
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          disabled={status === "loading"}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-60"
          placeholder="Je volledige naam"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-[var(--foreground)]"
        >
          E-mailadres *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={status === "loading"}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-60"
          placeholder="je@email.nl"
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="mb-1 block text-sm font-medium text-[var(--foreground)]"
        >
          Bericht (optioneel)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          disabled={status === "loading"}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] disabled:opacity-60"
          placeholder="Vraag over dit item..."
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-60"
      >
        {status === "loading" ? "Versturen..." : "Aanvraag versturen"}
      </button>
    </form>
  );
}
