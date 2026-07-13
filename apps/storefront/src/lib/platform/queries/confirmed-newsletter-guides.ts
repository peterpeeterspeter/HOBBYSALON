import { normalizeNewsletterEmail } from '@/lib/newsletter/lead-magnet';
import { createPlatformClient } from '@/lib/platform/client';
import {
  getConfirmedNewsletterGuides,
  type ConfirmedNewsletterGuide
} from '@/lib/profile/confirmed-newsletter-guides';

export type { ConfirmedNewsletterGuide } from '@/lib/profile/confirmed-newsletter-guides';

/**
 * Lists only the authenticated email's confirmed, still-active lead magnets.
 * Database and configuration failures deliberately return no guides.
 */
export async function listConfirmedNewsletterGuides(
  email: string | null | undefined
): Promise<ConfirmedNewsletterGuide[]> {
  const normalizedEmail = email ? normalizeNewsletterEmail(email) : null;
  if (!normalizedEmail) return [];

  try {
    const supabase = createPlatformClient();
    const { data, error } = await supabase
      .from('newsletter_opt_in_events')
      .select(
        'status, lead_magnet:newsletter_lead_magnets!inner(id, code, title, is_active)'
      )
      .eq('email', normalizedEmail)
      .eq('status', 'confirmed')
      .eq('lead_magnet.is_active', true);

    return error ? [] : getConfirmedNewsletterGuides(data ?? []);
  } catch {
    return [];
  }
}
