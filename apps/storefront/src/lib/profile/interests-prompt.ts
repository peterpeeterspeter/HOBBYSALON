/** One-time "Wat wil je vooral ontdekken?" prompt on /profile (replaces signup interests). */
export const INTERESTS_PROMPT_COOKIE = "hs_interests_prompt";

export function shouldShowInterestsPrompt(input: {
  interestCount: number;
  hasCreatorProfile: boolean;
  hasOfferIntent: boolean;
  dismissed: boolean;
}): boolean {
  if (input.dismissed) return false;
  if (input.interestCount > 0) return false;
  // Aanbieders get their own onboarding; do not stack a second prompt on them.
  if (input.hasCreatorProfile || input.hasOfferIntent) return false;
  return true;
}
