"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkoutUpdateAddress } from "@/app/actions/checkout";

export function CheckoutAddressForm({
  defaultEmail,
  defaultAddress,
}: {
  defaultEmail?: string;
  defaultAddress?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    postal_code?: string;
    province?: string;
    country_code?: string;
    phone?: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const timeout = new Promise<{ success: false; message: string }>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 15000)
      );
      const result = await Promise.race([
        checkoutUpdateAddress({ success: false }, formData),
        timeout,
      ]);
      if (result.success) {
        setIsSuccess(true);
        setMessage("Adres opgeslagen!");
        router.refresh();
      } else {
        setMessage(result.message ?? "Er ging iets mis");
      }
    } catch (err) {
      console.error("Checkout address error:", err);
      setMessage(
        err instanceof Error && err.message === "timeout"
          ? "Het duurt te lang. Controleer of de backend draait (poort 9000)."
          : "Er ging iets mis. Probeer het opnieuw."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-bold text-[var(--foreground)]">
        Verzendgegevens
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--foreground)]">
            E-mailadres <span className="text-[var(--accent)]">*</span>
          </span>
          <input
            type="email"
            name="email"
            required
            defaultValue={defaultEmail}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            placeholder="naam@voorbeeld.nl"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Voornaam <span className="text-[var(--accent)]">*</span>
          </span>
          <input
            type="text"
            name="first_name"
            required
            defaultValue={defaultAddress?.first_name}
            autoComplete="given-name"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Achternaam <span className="text-[var(--accent)]">*</span>
          </span>
          <input
            type="text"
            name="last_name"
            required
            defaultValue={defaultAddress?.last_name}
            autoComplete="family-name"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Adres <span className="text-[var(--accent)]">*</span>
        </span>
        <input
          type="text"
          name="address_1"
          required
          defaultValue={defaultAddress?.address_1}
          autoComplete="street-address"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          placeholder="Straat en huisnummer"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Adresregel 2
        </span>
        <input
          type="text"
          name="address_2"
          defaultValue={defaultAddress?.address_2}
          autoComplete="address-line2"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          placeholder="Appartement, etage, etc."
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Postcode <span className="text-[var(--accent)]">*</span>
          </span>
          <input
            type="text"
            name="postal_code"
            required
            defaultValue={defaultAddress?.postal_code}
            autoComplete="postal-code"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Plaats <span className="text-[var(--accent)]">*</span>
          </span>
          <input
            type="text"
            name="city"
            required
            defaultValue={defaultAddress?.city}
            autoComplete="address-level2"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </label>
      </div>

      <input type="hidden" name="country_code" value="nl" />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Telefoonnummer
        </span>
        <input
          type="tel"
          name="phone"
          defaultValue={defaultAddress?.phone}
          autoComplete="tel"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          placeholder="+31 6 12345678"
        />
      </label>

      {message && (
        <p
          className={
            isSuccess
              ? "text-sm text-green-600"
              : "text-sm text-red-600"
          }
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Bezig..." : "Verder naar verzending"}
      </button>
    </form>
  );
}
