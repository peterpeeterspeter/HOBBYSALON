import { redirect } from "next/navigation";
import { withFlash } from "@/lib/dashboard/return-path";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

/** The event list moved to "Mijn aanbod". Kept for bookmarks and old links. */
export default async function EventsRedirectPage({ searchParams }: Props) {
  const { success, error } = await searchParams;
  let target = "/dashboard/aanbod?soort=events";
  if (success) target = withFlash(target, "success", success);
  else if (error) target = withFlash(target, "error", error);
  redirect(target);
}
