import type { CreatorTab } from "@/components/dashboard/creator/types";

export const CREATOR_MAKER_PROFILE_PATH = "/profile";

export function creatorMakerProfileUrl(options?: {
  tab?: CreatorTab;
  success?: string;
  error?: string;
  withHash?: boolean;
}): string {
  const params = new URLSearchParams();
  if (options?.tab) {
    params.set("tab", options.tab);
  }
  if (options?.success) {
    params.set("success", options.success);
  }
  if (options?.error) {
    params.set("error", options.error);
  }

  const query = params.toString();
  const hash = options?.withHash ? "#maker-pagina" : "";
  return `${CREATOR_MAKER_PROFILE_PATH}${query ? `?${query}` : ""}${hash}`;
}
