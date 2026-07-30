import { redirect } from "next/navigation";

/** Legacy thin onboarding form — use Workshopbeheer instead. */
export default function OnboardingWorkshopRedirectPage() {
  redirect("/dashboard/workshops");
}
