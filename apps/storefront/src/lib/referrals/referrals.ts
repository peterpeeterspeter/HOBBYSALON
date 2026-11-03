import "server-only";

import { cookies } from "next/headers";
import { createPlatformClient } from "@/lib/platform/client";
import {
  MAX_REWARDED_REFERRALS,
  REFERRAL_COOKIE,
  freeMakerListingAllowance,
  normalizeReferralCode,
} from "./referral-rules";

export type ReferralSummary = {
  code: string;
  rewarded: number;
  remaining: number;
  bonusListings: number;
  freeListings: number;
};

export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  const { data, error } = await createPlatformClient().rpc("ensure_referral_code", {
    p_user_id: userId,
  });
  if (error || typeof data !== "string") return null;
  return data;
}

export async function getFreeListingBonus(userId: string): Promise<number> {
  const { data, error } = await createPlatformClient().rpc("free_listing_bonus", {
    p_user_id: userId,
  });
  if (error) return 0;
  return Number(data) || 0;
}

/** Free maker listings for a creator: base 3 plus referral bonuses of its user. */
export async function getFreeMakerListingsForCreator(creatorId: string): Promise<number> {
  const { data } = await createPlatformClient()
    .from("creators")
    .select("user_id")
    .eq("id", creatorId)
    .maybeSingle();
  const userId = (data as { user_id: string | null } | null)?.user_id;
  return freeMakerListingAllowance(userId ? await getFreeListingBonus(userId) : 0);
}

export async function getReferralSummary(userId: string): Promise<ReferralSummary | null> {
  const code = await getOrCreateReferralCode(userId);
  if (!code) return null;
  const supabase = createPlatformClient();
  const [{ count }, bonus] = await Promise.all([
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", userId)
      .eq("status", "rewarded"),
    getFreeListingBonus(userId),
  ]);
  const rewarded = count ?? 0;
  return {
    code,
    rewarded,
    remaining: Math.max(0, MAX_REWARDED_REFERRALS - rewarded),
    bonusListings: bonus,
    freeListings: freeMakerListingAllowance(bonus),
  };
}

/** The invite code from the cookie, for sign up metadata. */
export async function readReferralCookie(): Promise<string | null> {
  const store = await cookies();
  return normalizeReferralCode(store.get(REFERRAL_COOKIE)?.value);
}
