import { redirect } from "next/navigation";
import { withFlash } from "@/lib/dashboard/return-path";

type Props = {
  searchParams: Promise<{ success?: string; error?: string; checkout?: string; type?: string }>;
};

/**
 * The creations list moved to "Mijn aanbod" and credits to Instellingen.
 * Kept for bookmarks and the Stripe return URL of a credit pack.
 */
export default async function ProductsRedirectPage({ searchParams }: Props) {
  const { success, error, checkout, type } = await searchParams;
  if (type === "credits" || checkout) {
    let target = "/dashboard/instellingen";
    if (checkout === "pending") {
      target = withFlash(target, "success", "Betaling ontvangen. Je credits staan zo op je saldo.");
    } else if (checkout === "cancelled") {
      target = withFlash(target, "error", "Betaling geannuleerd. Er is niets aangerekend.");
    }
    redirect(`${target}#credits`);
  }
  let target = "/dashboard/aanbod?soort=creaties";
  if (success) target = withFlash(target, "success", success);
  else if (error) target = withFlash(target, "error", error);
  redirect(target);
}
