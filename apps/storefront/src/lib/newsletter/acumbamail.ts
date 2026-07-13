type AcumbamailSubscriber = {
  email: string;
  firstName: string | null;
  preferredCity: string | null;
  sourcePath: string;
  confirmedAt: string;
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

export async function syncConfirmedAcumbamailSubscriber(
  subscriber: AcumbamailSubscriber
): Promise<boolean> {
  const endpoint = process.env.ACUMBAMAIL_WEBHOOK_URL;
  if (!endpoint || process.env.NODE_ENV === "test") return false;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAcumbamailSubscriberPayload(subscriber)),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
