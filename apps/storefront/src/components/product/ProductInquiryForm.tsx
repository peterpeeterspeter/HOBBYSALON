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
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h3 className="text-base font-semibold text-green-800">
          Bericht verstuurd
        </h3>
        <p className="mt-1 text-sm text-green-700">
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
        <label className="mb-1 block text-sm font-medium" htmlFor="full_name">
          Naam *
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">
          E-mail *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="message">
          Bericht
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)]"
          placeholder="Ik ben geïnteresseerd in dit stuk…"
        />
      </div>
      {status === "error" && (
        <p className="text-sm text-red-700">{errorMessage}</p>
      )}
      <Button type="submit" disabled={status === "loading"} className="w-full">
        {status === "loading" ? "Versturen…" : "Bericht sturen"}
      </Button>
    </form>
  );
}
