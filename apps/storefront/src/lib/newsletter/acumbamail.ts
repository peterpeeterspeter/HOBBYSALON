/** Acumbamail list "Hobbysalon Subscribers". */
const DEFAULT_LIST_ID = "836565";

type AcumbamailSubscriber = {
  email: string;
  firstName: string | null;
  preferredCity: string | null;
  sourcePath: string;
  confirmedAt: string;
};

export type AcumbamailSyncResult = {
  ok: boolean;
  /** True when ACUMBAMAIL_AUTH_TOKEN is unset or NODE_ENV=test. */
  skipped: boolean;
  status: number | null;
};

export function acumbamailListId(): string {
  return process.env.ACUMBAMAIL_LIST_ID?.trim() || DEFAULT_LIST_ID;
}

export function buildAcumbamailSubscriberPayload(subscriber: AcumbamailSubscriber) {
  const email = subscriber.email.trim().toLocaleLowerCase("nl-BE");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Ongeldig e-mailadres voor Acumbamail.");
  }

  return {
    email,
    Voornaam: subscriber.firstName ?? "",
    Plaats: subscriber.preferredCity ?? "",
    Taal: "nl",
    country: "BE",
    optin: "1",
    url: subscriber.sourcePath,
    added: subscriber.confirmedAt,
  };
}

export function isAcumbamailSyncConfigured(): boolean {
  return Boolean(process.env.ACUMBAMAIL_AUTH_TOKEN?.trim()) && process.env.NODE_ENV !== "test";
}

/**
 * Best-effort sync to Acumbamail after Hobbysalon consent.
 * Never logs email or other PII — only HTTP status / skip reason.
 */
export async function syncConfirmedAcumbamailSubscriber(
  subscriber: AcumbamailSubscriber
): Promise<AcumbamailSyncResult> {
  const authToken = process.env.ACUMBAMAIL_AUTH_TOKEN?.trim();
  if (!authToken || process.env.NODE_ENV === "test") {
    return { ok: false, skipped: true, status: null };
  }

  const mergeFields = buildAcumbamailSubscriberPayload(subscriber);
  const body = new URLSearchParams();
  body.set("auth_token", authToken);
  body.set("list_id", acumbamailListId());
  body.set("double_optin", "0");
  body.set("welcome_email", "0");
  body.set("update_subscriber", "1");
  body.set("response_type", "json");
  for (const [key, value] of Object.entries(mergeFields)) {
    body.set(`merge_fields[${key}]`, value);
  }

  try {
    const response = await fetch("https://acumbamail.com/api/1/addSubscriber/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
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
