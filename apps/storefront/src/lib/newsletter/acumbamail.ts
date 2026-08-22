type AcumbamailSubscriber = {
  email: string;
  firstName: string | null;
  preferredCity: string | null;
  sourcePath: string;
  confirmedAt: string;
};

export type AcumbamailSyncResult = {
  ok: boolean;
  /** True when ACUMBAMAIL_WEBHOOK_URL is unset or NODE_ENV=test. */
  skipped: boolean;
  status: number | null;
};

export function buildAcumbamailSubscriberPayload(subscriber: AcumbamailSubscriber) {
  const email = subscriber.email.trim().toLocaleLowerCase("nl-BE");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Ongeldig e-mailadres voor Acumbamail.");
  }

  return {
    email,
    double_optin: 0,
    welcome_email: 0,
    update_subscriber: 1,
    voornaam: subscriber.firstName ?? "",
    plaats: subscriber.preferredCity ?? "",
    taal: "nl",
    country: "BE",
    optin: 1,
    url: subscriber.sourcePath,
    added: subscriber.confirmedAt,
  };
}

export function isAcumbamailSyncConfigured(): boolean {
  return Boolean(process.env.ACUMBAMAIL_WEBHOOK_URL?.trim()) && process.env.NODE_ENV !== "test";
}

/**
 * Best-effort sync to Acumbamail after Hobbysalon consent.
 * Never logs email or other PII — only HTTP status / skip reason.
 */
export async function syncConfirmedAcumbamailSubscriber(
  subscriber: AcumbamailSubscriber
): Promise<AcumbamailSyncResult> {
  const endpoint = process.env.ACUMBAMAIL_WEBHOOK_URL?.trim();
  if (!endpoint || process.env.NODE_ENV === "test") {
    return { ok: false, skipped: true, status: null };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAcumbamailSubscriberPayload(subscriber)),
      cache: "no-store",
    });

    if (response.ok) {
      console.info("[acumbamail] sync ok", { status: response.status });
      return { ok: true, skipped: false, status: response.status };
    }

    console.warn("[acumbamail] sync failed", { status: response.status });
    return { ok: false, skipped: false, status: response.status };
  } catch (error) {
    console.warn("[acumbamail] sync error", {
      status: null,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, skipped: false, status: null };
  }
}
