import { redirect } from "next/navigation";

/** Legacy thin onboarding form — use Productbeheer instead. */
export default function OnboardingProductRedirectPage() {
  redirect("/dashboard/products");
}
