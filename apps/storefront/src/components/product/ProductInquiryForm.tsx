"use client";

import { useState } from "react";
import { submitProductInquiry } from "@/app/actions/product-inquiry";
import { trackEvent } from "@/lib/analytics/track";
import { Button } from "@/components/ui/button";

type Props = {
  productId: string;
  creatorId: string;
  creatorName: string;
};

export function ProductInquiryForm({
  productId,
  creatorId,
  creatorName,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    setStatus("loading");
    setErrorMessage("");

    const result = await submitProductInquiry(productId, creatorId, formData);

    if (result.success) {
      trackEvent("product_inquiry_submitted", {
        product_id: productId,
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
        <h3 className="text-base font-semibold text-green-800 dark:text-green-200">
          Bericht verstuurd
        </h3>
        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
          {creatorName} ontvangt je vraag en neemt contact met je op. Betaling
          verloopt rechtstreeks tussen jullie — niet via Hobbysalon.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <h3 className="text-base font-semibold text-[var(--foreground)]">
        Vraag stellen aan {creatorName}
      </h3>
      <p className="text-sm text-[var(--muted)]">
        Dit is een plaatsing, geen webshop-checkout. Stuur een bericht om te
        kopen of meer te weten.
      </p>
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
          placeholder="Ik ben geïnteresseerd in dit stuk…"
        />
      </div>
      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}
      <Button type="submit" disabled={status === "loading"} className="w-full">
        {status === "loading" ? "Versturen…" : "Bericht sturen"}
      </Button>
    </form>
  );
}
