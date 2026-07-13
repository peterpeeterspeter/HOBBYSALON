import { createPlatformClient } from "@/lib/platform/client";
import {
  toActiveNewsletterLeadMagnet,
  type ActiveNewsletterLeadMagnet,
} from "./newsletter-lead-magnet";

export type { ActiveNewsletterLeadMagnet } from "./newsletter-lead-magnet";

/**
 * Returns a campaign only when it can safely be shown publicly.
 * A database or configuration failure deliberately hides the campaign.
 */
export async function getActiveNewsletterLeadMagnet(
  code: string
): Promise<ActiveNewsletterLeadMagnet | null> {
  try {
    const supabase = createPlatformClient();
    const { data, error } = await supabase
      .from("newsletter_lead_magnets")
      .select("id, code, title, is_active")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    return error ? null : toActiveNewsletterLeadMagnet(data);
  } catch {
    return null;
  }
}
