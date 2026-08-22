import { redirect } from "next/navigation";

/** Legacy thin onboarding form — use Eventbeheer instead. */
export default function OnboardingEventRedirectPage() {
  redirect("/dashboard/events");
}
