export type ConfirmedNewsletterGuide = {
  id: string;
  code: string;
  title: string;
};

type LeadMagnetRow = {
  id?: unknown;
  code?: unknown;
  title?: unknown;
  is_active?: unknown;
};

type NewsletterOptInRow = {
  email?: unknown;
  status?: unknown;
  lead_magnet?: LeadMagnetRow | LeadMagnetRow[] | null;
};

function toConfirmedNewsletterGuide(
  row: NewsletterOptInRow
): ConfirmedNewsletterGuide | null {
  const leadMagnet = Array.isArray(row.lead_magnet)
    ? row.lead_magnet[0]
    : row.lead_magnet;
  if (
    row.status !== 'confirmed' ||
    !leadMagnet ||
    leadMagnet.is_active !== true ||
    typeof leadMagnet.id !== 'string' ||
    typeof leadMagnet.code !== 'string' ||
    typeof leadMagnet.title !== 'string' ||
    !leadMagnet.id.trim() ||
    !leadMagnet.code.trim() ||
    !leadMagnet.title.trim()
  ) {
    return null;
  }

  return {
    id: leadMagnet.id,
    code: leadMagnet.code,
    title: leadMagnet.title
  };
}

export function getConfirmedNewsletterGuides(
  rows: NewsletterOptInRow[]
): ConfirmedNewsletterGuide[] {
  const guidesById = new Map<string, ConfirmedNewsletterGuide>();

  for (const row of rows) {
    const guide = toConfirmedNewsletterGuide(row);
    if (guide) guidesById.set(guide.id, guide);
  }

  return [...guidesById.values()].sort(
    (left, right) =>
      left.title.localeCompare(right.title, 'nl') ||
      left.id.localeCompare(right.id)
  );
}
