"use client";

import { useState } from "react";
import { submitWorkshopBookingRequest } from "@/app/actions/workshop-booking";

type WorkshopSession = {
  id: string;
  starts_at: string;
  ends_at: string;
};

type Props = {
  workshopId: string;
  creatorId: string;
  sessions: WorkshopSession[];
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function WorkshopBookingRequestForm({
  workshopId,
  creatorId,
  sessions,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleSubmit(formData: FormData) {
    setStatus("loading");
    setErrorMessage("");

    const result = await submitWorkshopBookingRequest(
      workshopId,
      creatorId,
      formData
    );

    if (result.success) {
      setStatus("success");
    } else {
      setStatus("error");
      setErrorMessage(result.message ?? "Er is iets misgegaan.");
    }
  }

  if (status === "success") {
    return (
      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/30">
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
          Aanvraag verstuurd
        </h3>
        <p className="mt-2 text-green-700 dark:text-green-300">
          Je boekingsaanvraag is ontvangen. De workshopleider neemt zo snel
          mogelijk contact met je op.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="mt-6 space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">
        Boekingsaanvraag
      </h3>

      {sessions.length > 0 && (
        <div>
          <label
            htmlFor="session"
            className="block text-sm font-medium text-[var(--foreground)] mb-1"
          >
            Gewenste datum
          </label>
          <select
            id="session"
            name="workshop_session_id"
            className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
          >
            <option value="">Selecteer een datum</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDate(s.starts_at)} – {formatDate(s.ends_at)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label
          htmlFor="full_name"
          className="block text-sm font-medium text-[var(--foreground)] mb-1"
        >
          Naam *
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          disabled={status === "loading"}
          className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] disabled:opacity-60"
          placeholder="Je volledige naam"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-[var(--foreground)] mb-1"
        >
          E-mailadres *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={status === "loading"}
          className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] disabled:opacity-60"
          placeholder="je@email.nl"
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-[var(--foreground)] mb-1"
        >
          Bericht (optioneel)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          disabled={status === "loading"}
          className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] disabled:opacity-60"
          placeholder="Eventuele vragen of opmerkingen..."
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-60"
      >
        {status === "loading" ? "Versturen..." : "Aanvraag versturen"}
      </button>
    </form>
  );
}
