"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { REGISTRATION_ALLOWED_INTEREST_TYPES } from "@/lib/auth/registration-options";
import { persistUserRegistrationProfile } from "@/lib/platform/queries/user-registration";
import { INTERESTS_PROMPT_COOKIE } from "@/lib/profile/interests-prompt";

const ALLOWED = new Set<string>(REGISTRATION_ALLOWED_INTEREST_TYPES);

/** Saves the one-time interests answer (or a skip) and hides the prompt. */
export async function saveDiscoveryInterestsAction(
  formData: FormData
): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/profile");
  }

  if (formData.get("skip") !== "1") {
    const interestTypes = formData
      .getAll("interest_types")
      .map((value) => value.toString().trim().toLowerCase())
      .filter((value) => ALLOWED.has(value));

    if (interestTypes.length > 0) {
      // Partial write: only interest_types (consent/offer intent untouched).
      const result = await persistUserRegistrationProfile({
        userId: user.id,
        interestTypes,
      });
      if (!result.ok) {
        console.error("Failed to save discovery interests", {
          userId: user.id,
          errors: result.errors,
        });
        redirect(
          `/profile?error=${encodeURIComponent("Opslaan mislukt. Probeer het opnieuw.")}`
        );
      }
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(INTERESTS_PROMPT_COOKIE, "done", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/profile");
  redirect("/profile");
}
