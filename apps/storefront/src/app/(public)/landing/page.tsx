import { redirect } from "next/navigation";

/** Legacy path: Over ons lives at /over-ons. */
export default function LandingRedirectPage() {
  redirect("/over-ons");
}
