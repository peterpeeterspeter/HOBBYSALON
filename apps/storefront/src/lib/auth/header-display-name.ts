/**
 * Short first-name label for the header profile trigger (display only, not auth).
 */

export function resolveHeaderDisplayName(options: {
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
}): string | null {
  const fromMeta = firstNameToken(options.fullName) ?? firstNameToken(options.name);
  if (fromMeta) return fromMeta;

  const email = options.email?.trim();
  if (!email || !email.includes("@")) return null;

  const local = email.split("@")[0]?.trim() ?? "";
  if (!local || local.length < 2) return null;
  if (/^\d+$/.test(local)) return null;

  const token = local.split(/[._+\-]/)[0]?.trim() ?? "";
  if (token.length < 2) return null;
  return titleCaseToken(token);
}

function firstNameToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const token = trimmed.split(/\s+/)[0]?.trim() ?? "";
  if (token.length < 2) return null;
  if (token.includes("@")) return null;
  return titleCaseToken(token);
}

function titleCaseToken(token: string): string {
  const lower = token.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
