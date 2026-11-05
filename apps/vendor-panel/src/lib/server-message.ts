/**
 * The API answers in English. Show the common messages in Dutch;
 * unknown messages are shown as they are.
 */
const EXACT: Record<string, string> = {
  "Invalid email or password": "E-mailadres of wachtwoord klopt niet.",
  Unauthorized: "Je bent niet (meer) aangemeld. Log opnieuw in.",
  "Not allowed": "Dat mag je niet doen.",
  Forbidden: "Dat mag je niet doen.",
  "Identity with email already exists": "Dit e-mailadres is al in gebruik.",
  "Seller is not approved": "Je winkel is nog niet goedgekeurd door Hobbysalon.",
  "An unknown error occurred.": "Er ging iets mis. Probeer het opnieuw.",
  "Failed to fetch": "Geen verbinding met de server. Probeer het opnieuw.",
}

const PATTERNS: Array<[RegExp, string]> = [
  [/was not found|not found/i, "Niet gevonden. Vernieuw de pagina en probeer opnieuw."],
  [/already exists/i, "Dit bestaat al."],
  [/is not a material category/i, "Kies een materiaalcategorie."],
  [/invalid request|invalid data|is required|must be/i, "Niet alle gegevens zijn juist ingevuld."],
  [/too many requests/i, "Te veel pogingen. Wacht even en probeer opnieuw."],
]

export function toDutchServerMessage(message?: string | null): string {
  const text = (message ?? "").trim()
  if (!text) return "Er ging iets mis. Probeer het opnieuw."
  if (EXACT[text]) return EXACT[text]
  for (const [re, nl] of PATTERNS) if (re.test(text)) return nl
  return text
}
