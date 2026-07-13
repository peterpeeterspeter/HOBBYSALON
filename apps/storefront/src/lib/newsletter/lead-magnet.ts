import { createHmac, timingSafeEqual } from "node:crypto";

type ConfirmationPayload = {
  email: string;
  leadMagnetCode: string;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function normalizeNewsletterEmail(value: string): string | null {
  const email = value.trim().toLocaleLowerCase("nl-BE");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function createConfirmationToken(
  payload: ConfirmationPayload,
  secret: string
): string {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyConfirmationToken(
  token: string,
  secret: string
): ConfirmationPayload | null {
  const [encodedPayload, signature, ...rest] = token.split(".");
  if (!encodedPayload || !signature || rest.length > 0) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<ConfirmationPayload>;
    const email = typeof parsed.email === "string" ? normalizeNewsletterEmail(parsed.email) : null;
    const leadMagnetCode =
      typeof parsed.leadMagnetCode === "string" ? parsed.leadMagnetCode.trim() : "";

    return email && leadMagnetCode ? { email, leadMagnetCode } : null;
  } catch {
    return null;
  }
}

export function buildConfirmationUrl(siteUrl: string, token: string): string {
  const url = new URL("/nieuwsbrief/bevestigen", siteUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function getNewsletterSiteUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
