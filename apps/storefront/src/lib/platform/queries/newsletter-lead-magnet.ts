export type ActiveNewsletterLeadMagnet = {
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

export function toActiveNewsletterLeadMagnet(
  row: LeadMagnetRow | null | undefined
): ActiveNewsletterLeadMagnet | null {
  if (
    !row ||
    row.is_active !== true ||
    typeof row.id !== "string" ||
    typeof row.code !== "string" ||
    typeof row.title !== "string" ||
    !row.id.trim() ||
    !row.code.trim() ||
    !row.title.trim()
  ) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    title: row.title,
  };
}
