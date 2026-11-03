/**
 * Maker referral rules. Pure configuration, so it is testable on its own.
 * The database trigger `reward_referral_on_confirm` uses the same numbers.
 */
export const BASE_FREE_MAKER_LISTINGS = 3;
export const REFERRAL_REWARD_LISTINGS = 3;
export const MAX_REWARDED_REFERRALS = 5;
export const REFERRAL_COOKIE = "hs_ref";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const CODE = /^[A-Z2-9]{8}$/;

/** Uppercased code, or null when it cannot be a referral code. */
export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

export function freeMakerListingAllowance(bonus: number): number {
  return BASE_FREE_MAKER_LISTINGS + Math.max(0, Math.floor(bonus));
}
