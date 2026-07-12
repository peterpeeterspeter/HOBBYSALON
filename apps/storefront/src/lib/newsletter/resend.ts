import "server-only";

type NewsletterEmail = {
  to: string;
  subject: string;
  html: string;
};

function getResendConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

export function isNewsletterEmailConfigured(): boolean {
  return Boolean(getResendConfig()) && process.env.NODE_ENV !== "test";
}

/** Uses the same Resend API key and sender configuration as the backend provider. */
export async function sendNewsletterEmail(email: NewsletterEmail): Promise<boolean> {
  const config = getResendConfig();
  if (!config || process.env.NODE_ENV === "test") return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: config.from, ...email }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
