import "server-only";

import { createPlatformClient } from "./client";

export const LISTING_CREDIT_COSTS = {
  handmadeListing: 1,
  collectionListing: 3,
  listingBump: 1,
  spotlight7Days: 5,
  homepageSpotlight: 20,
  newsletterFeature: 35,
} as const;

export async function getCreditBalance(creatorId: string): Promise<number> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("listing_credit_wallets")
    .select("balance")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (error || !data) return 0;
  return data.balance ?? 0;
}

export async function ensureCreditWallet(creatorId: string): Promise<number> {
  const supabase = createPlatformClient();
  const { data: existing } = await supabase
    .from("listing_credit_wallets")
    .select("balance")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (existing) return existing.balance ?? 0;

  const { data: created, error } = await supabase
    .from("listing_credit_wallets")
    .insert({ creator_id: creatorId, balance: 0 })
    .select("balance")
    .single();

  if (error || !created) return 0;
  return created.balance ?? 0;
}

export async function addCredits(
  creatorId: string,
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {}
): Promise<{ ok: boolean; balance?: number; error?: string }> {
  if (amount <= 0) return { ok: false, error: "Amount must be positive" };

  await ensureCreditWallet(creatorId);
  const supabase = createPlatformClient();
  const balance = await getCreditBalance(creatorId);
  const newBalance = balance + amount;

  const { error: txError } = await supabase.from("listing_credit_transactions").insert({
    creator_id: creatorId,
    amount,
    reason,
    metadata,
  });

  if (txError) return { ok: false, error: txError.message };

  const { error: walletError } = await supabase
    .from("listing_credit_wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("creator_id", creatorId);

  if (walletError) return { ok: false, error: walletError.message };
  return { ok: true, balance: newBalance };
}

export async function consumeCredits(
  creatorId: string,
  amount: number,
  reason: string,
  relatedEntity?: { type: string; id: string },
  metadata: Record<string, unknown> = {}
): Promise<{ ok: boolean; balance?: number; error?: string }> {
  if (amount <= 0) return { ok: false, error: "Amount must be positive" };

  await ensureCreditWallet(creatorId);
  const balance = await getCreditBalance(creatorId);
  if (balance < amount) {
    return { ok: false, error: "Onvoldoende listing credits." };
  }

  const supabase = createPlatformClient();
  const newBalance = balance - amount;

  const { error: txError } = await supabase.from("listing_credit_transactions").insert({
    creator_id: creatorId,
    amount: -amount,
    reason,
    related_entity_type: relatedEntity?.type ?? null,
    related_entity_id: relatedEntity?.id ?? null,
    metadata,
  });

  if (txError) return { ok: false, error: txError.message };

  const { error: walletError } = await supabase
    .from("listing_credit_wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("creator_id", creatorId);

  if (walletError) return { ok: false, error: walletError.message };
  return { ok: true, balance: newBalance };
}

export async function canCreateHandmadeListing(
  creatorId: string,
  usesCredits: boolean,
  includedFree: number,
  activeProductCount: number
): Promise<{ allowed: boolean; reason?: string }> {
  if (!usesCredits) {
    if (activeProductCount >= includedFree) {
      return { allowed: false, reason: "Je hebt het maximum aantal actieve producten bereikt." };
    }
    return { allowed: true };
  }

  const balance = await getCreditBalance(creatorId);
  if (balance < LISTING_CREDIT_COSTS.handmadeListing) {
    return {
      allowed: false,
      reason: "Onvoldoende listing credits. Koop credits om een product te publiceren.",
    };
  }
  return { allowed: true };
}

export async function countActiveHandmadeProducts(creatorId: string): Promise<number> {
  const supabase = createPlatformClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("product_type", "handmade")
    .eq("status", "active");

  if (error) return 0;
  return count ?? 0;
}
