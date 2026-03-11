"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { checkoutInitiatePayment, checkoutComplete } from "@/app/actions/checkout";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function PaymentFormInner({
  total,
  currencyCode,
  onTerminalError,
}: {
  total: number;
  currencyCode: string;
  onTerminalError?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPending(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/complete`,
        payment_method_data: {
          billing_details: {
            address: {
              country: "NL",
            },
          },
        },
      },
    });

    if (error) {
      const msg = error.message ?? "Betaling mislukt";
      const hint =
        msg.includes("verwerkingsfout") || msg.includes("processing error")
          ? " Probeer de Stripe testkaart 4242 4242 4242 4242 of een andere kaart."
          : "";
      setMessage(msg + hint);
      setPending(false);
      return;
    }

    // If we get here (no redirect, e.g. no 3DS), complete the order
    const result = await checkoutComplete({ redirect: true });
    if (!result.success) {
      setMessage(result.message ?? "Bestelling kon niet worden afgerond");
    }
    setPending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-bold text-[var(--foreground)]">
        Betaling
      </h2>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        {loadError && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            {onTerminalError && (
              <button
                type="button"
                onClick={onTerminalError}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]"
              >
                Opnieuw laden
              </button>
            )}
          </div>
        )}
        <PaymentElement
          options={{ layout: "tabs" }}
          onLoadError={(e) => {
            const err = (e as { error?: { message?: string; type?: string } }).error;
            const msg =
              err?.message ??
              "Betalingselement kon niet worden geladen. Controleer de Stripe-configuratie (zelfde account voor backend en storefront).";
            const isTerminal =
              typeof msg === "string" &&
              (msg.includes("terminal state") || msg.includes("terminale status"));
            if (process.env.NODE_ENV === "development") {
              console.error("[PaymentElement loaderror]", err ?? e);
            }
            setLoadError(isTerminal ? "De vorige betalingssessie is verlopen. Klik op Opnieuw laden." : msg);
            isTerminal && onTerminalError?.();
          }}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <span className="font-medium text-[var(--foreground)]">Totaal</span>
        <span className="text-xl font-bold text-[var(--foreground)]">
          {formatPrice(total, currencyCode)}
        </span>
      </div>

      {message && (
        <p className="text-sm text-red-600">{message}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || pending}
        className="w-full rounded-lg bg-[var(--accent)] px-6 py-4 font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Bezig met betalen..." : "Bestelling plaatsen"}
      </button>
    </form>
  );
}

export function CheckoutPaymentForm({
  total,
  currencyCode,
}: {
  total: number;
  currencyCode: string;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [elementsKey, setElementsKey] = useState(0);

  const fetchPayment = () => {
    setLoading(true);
    setError(null);
    checkoutInitiatePayment()
      .then((res) => {
        if (res.success && res.clientSecret) {
          setClientSecret(res.clientSecret);
          setElementsKey((k) => k + 1);
        } else {
          setError(res.message ?? "Betaling kon niet worden gestart");
        }
      })
      .catch(() => setError("Er ging iets mis"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPayment();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="text-[var(--muted)]">Betaling voorbereiden...</p>
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">
          Betaling
        </h2>
        <p className="text-red-600">
          {error ?? "Betaling is niet beschikbaar. Controleer de configuratie."}
        </p>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">
          Betaling
        </h2>
        <p className="text-[var(--muted)]">
          Stripe is niet geconfigureerd. Stel NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in.
        </p>
      </div>
    );
  }

  return (
    <Elements
      key={elementsKey}
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#c17f59",
            borderRadius: "0.5rem",
          },
        },
        locale: "nl",
      }}
    >
      <PaymentFormInner
        total={total}
        currencyCode={currencyCode}
        onTerminalError={fetchPayment}
      />
    </Elements>
  );
}
