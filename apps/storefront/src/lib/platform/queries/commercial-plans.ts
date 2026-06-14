import "server-only";

import type {
  CommercialPlan,
  CommercialSegment,
  CreatorPlanSubscription,
  EventPlanSubscription,
} from "@/types/platform";
import { createPlatformClient } from "../client";

const ACTIVE_STATUSES = ["active", "trialing"];

export function isCommercialGatingEnabled(): boolean {
  return process.env.COMMERCIAL_GATING_ENABLED === "true";
}

export async function getCommercialPlanByCode(
  code: string
): Promise<CommercialPlan | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("commercial_plans")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as CommercialPlan;
}

export async function listCommercialPlansBySegment(
  segment: CommercialSegment
): Promise<CommercialPlan[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("commercial_plans")
    .select("*")
    .eq("segment", segment)
    .eq("is_active", true)
    .order("price_cents", { ascending: true });

  if (error || !data) return [];
  return data as CommercialPlan[];
}

function isSubscriptionActive(sub: {
  status: string;
  starts_at: string;
  ends_at: string | null;
}): boolean {
  if (!ACTIVE_STATUSES.includes(sub.status)) return false;
  const now = Date.now();
  if (new Date(sub.starts_at).getTime() > now) return false;
  if (sub.ends_at && new Date(sub.ends_at).getTime() < now) return false;
  return true;
}

export async function getActivePlanForCreator(
  creatorId: string,
  segment: CommercialSegment
): Promise<(CreatorPlanSubscription & { plan: CommercialPlan }) | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("creator_plan_subscriptions")
    .select("*, plan:commercial_plans(*)")
    .eq("creator_id", creatorId)
    .in("status", ACTIVE_STATUSES);

  if (error || !data?.length) return null;

  const match = (data as Array<
    CreatorPlanSubscription & { plan: CommercialPlan | CommercialPlan[] }
  >).find((row) => {
    const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
    return plan?.segment === segment && isSubscriptionActive(row);
  });

  if (!match) return null;
  const plan = Array.isArray(match.plan) ? match.plan[0] : match.plan;
  if (!plan) return null;
  return { ...match, plan };
}

export async function getActivePlansForCreator(
  creatorId: string
): Promise<Array<CreatorPlanSubscription & { plan: CommercialPlan }>> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("creator_plan_subscriptions")
    .select("*, plan:commercial_plans(*)")
    .eq("creator_id", creatorId)
    .in("status", ACTIVE_STATUSES);

  if (error || !data) return [];

  return (data as Array<
    CreatorPlanSubscription & { plan: CommercialPlan | CommercialPlan[] }
  >)
    .filter(isSubscriptionActive)
    .map((row) => {
      const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
      return { ...row, plan: plan! };
    })
    .filter((row) => row.plan);
}

export async function getActivePlanForEvent(
  eventId: string
): Promise<(EventPlanSubscription & { plan: CommercialPlan }) | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("event_plan_subscriptions")
    .select("*, plan:commercial_plans(*)")
    .eq("event_id", eventId)
    .in("status", ACTIVE_STATUSES)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  if (!isSubscriptionActive(data)) return null;

  const plan = Array.isArray(data.plan) ? data.plan[0] : data.plan;
  if (!plan) return null;
  return { ...(data as EventPlanSubscription), plan: plan as CommercialPlan };
}

export async function countActiveWorkshopsForCreator(
  creatorId: string
): Promise<number> {
  const supabase = createPlatformClient();
  const { count, error } = await supabase
    .from("workshops")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("is_active", true);

  if (error) return 0;
  return count ?? 0;
}
