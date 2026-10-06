import { redirect } from "next/navigation";
import { withFlash } from "@/lib/dashboard/return-path";

type Props = {
  searchParams: Promise<{ success?: string; error?: string; checkout?: string }>;
};

/** The workshop list moved to "Mijn aanbod". Kept for bookmarks and the Stripe return URL. */
export default async function WorkshopsRedirectPage({ searchParams }: Props) {
  const { success, error, checkout } = await searchParams;
  let target = "/dashboard/aanbod?soort=workshops";
  if (checkout === "pending") {
    target = withFlash(target, "success", "Betaling ontvangen. Je workshop wordt zo zichtbaar.");
  } else if (checkout === "cancelled") {
    target = withFlash(target, "error", "Betaling geannuleerd. Je workshop blijft een concept.");
  } else if (success) {
    target = withFlash(target, "success", success);
  } else if (error) {
    target = withFlash(target, "error", error);
  }
  redirect(target);
}
