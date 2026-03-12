"use server";

import { redirect } from "next/navigation";
import {
  clearAuthSession,
  createEmailSession,
  persistAuthSession,
  registerEmailUser,
} from "@/lib/auth/session";
import {
  REGISTRATION_ALLOWED_INTEREST_TYPES,
  type RegistrationInterestType,
} from "@/lib/auth/registration-options";
import { persistCreatorRegistrationProfile } from "@/lib/platform/queries/creator-registration";
import { persistUserRegistrationProfile } from "@/lib/platform/queries/user-registration";

export type AuthActionState = {
  success: boolean;
  message: string;
};

const ALLOWED_REGISTRATION_INTEREST_TYPES = new Set<string>(
  REGISTRATION_ALLOWED_INTEREST_TYPES
);
const ALLOWED_CREATOR_TYPES = new Set<string>([
  "maker",
  "workshopgever",
  "supplier",
  "content_creator",
  "organizer",
]);

function parseInterestTypes(formData: FormData): RegistrationInterestType[] {
  return (formData.getAll("interest_types") ?? [])
    .map((value) => value.toString().trim().toLowerCase())
    .filter(
      (value): value is RegistrationInterestType =>
        ALLOWED_REGISTRATION_INTEREST_TYPES.has(value)
    );
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const nextPath = formData.get("next")?.toString() || "/dashboard";

  if (!email || !password) {
    return {
      success: false,
      message: "E-mail en wachtwoord zijn verplicht.",
    };
  }

  const { session, error } = await createEmailSession(email, password);

  if (error || !session) {
    return {
      success: false,
      message: "Aanmelden mislukt. Controleer je gegevens.",
    };
  }

  await persistAuthSession(session);
  redirect(nextPath);
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const postalCode = formData.get("postal_code")?.toString() ?? null;
  const countryCode = formData.get("country_code")?.toString() ?? null;
  const interestTypes = parseInterestTypes(formData);
  const nextPath = formData.get("next")?.toString() || "/dashboard";

  if (!email || !password) {
    return {
      success: false,
      message: "E-mail en wachtwoord zijn verplicht.",
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message: "Wachtwoord moet minimaal 8 karakters bevatten.",
    };
  }

  const { session, user, error } = await registerEmailUser(email, password);

  if (error) {
    return {
      success: false,
      message: "Registratie mislukt. Gebruik een ander e-mailadres.",
    };
  }

  let profilePersisted = true;
  const registrationUserId = user?.id ?? session?.user?.id ?? null;

  if (registrationUserId) {
    const profileResult = await persistUserRegistrationProfile({
      userId: registrationUserId,
      postalCode,
      countryCode,
      interestTypes,
    });

    if (!profileResult.ok) {
      profilePersisted = false;
      console.error("Failed to persist registration profile", {
        userId: registrationUserId,
        errors: profileResult.errors,
      });
    }
  }

  if (session) {
    await persistAuthSession(session);
    redirect(nextPath);
  }

  if (user) {
    return {
      success: true,
      message: profilePersisted
        ? "Account aangemaakt. Bevestig je e-mail indien vereist en meld je daarna aan."
        : "Account aangemaakt. Bevestig je e-mail en werk je voorkeuren later bij in je profiel.",
    };
  }

  return {
    success: false,
    message: "Registratie mislukt.",
  };
}

export async function registerCreatorAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const displayName = formData.get("display_name")?.toString().trim() ?? "";
  const businessName = formData.get("business_name")?.toString() ?? null;
  const preferredSlug = formData.get("slug")?.toString() ?? null;
  const city = formData.get("city")?.toString() ?? null;
  const postalCode = formData.get("postal_code")?.toString() ?? null;
  const countryCode = formData.get("country_code")?.toString() ?? null;
  const creatorTypes = (formData.getAll("creator_types") ?? [])
    .map((value) => value.toString().trim().toLowerCase())
    .filter((value) => ALLOWED_CREATOR_TYPES.has(value));
  const interestTypes = parseInterestTypes(formData);
  const nextPath = formData.get("next")?.toString() || "/dashboard/creator";

  if (!displayName) {
    return {
      success: false,
      message: "Naam is verplicht.",
    };
  }

  if (!email || !password) {
    return {
      success: false,
      message: "E-mail en wachtwoord zijn verplicht.",
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message: "Wachtwoord moet minimaal 8 karakters bevatten.",
    };
  }

  const { session, user, error } = await registerEmailUser(email, password);

  if (error) {
    return {
      success: false,
      message: "Registratie mislukt. Gebruik een ander e-mailadres.",
    };
  }

  let profilePersisted = true;
  const registrationUserId = user?.id ?? session?.user?.id ?? null;

  if (registrationUserId) {
    const profileResult = await persistCreatorRegistrationProfile({
      userId: registrationUserId,
      displayName,
      businessName,
      preferredSlug,
      city,
      postalCode,
      countryCode,
      interestTypes,
      creatorTypes,
    });

    if (!profileResult.ok) {
      profilePersisted = false;
      console.error("Failed to persist creator registration profile", {
        userId: registrationUserId,
        errors: profileResult.errors,
      });
    }
  }

  if (session) {
    await persistAuthSession(session);
    redirect(nextPath);
  }

  if (user) {
    return {
      success: true,
      message: profilePersisted
        ? "Creator-account aangemaakt. Bevestig je e-mail indien vereist en meld je daarna aan."
        : "Creator-account aangemaakt. Bevestig je e-mail en werk je creator-profiel bij in je dashboard.",
    };
  }

  return {
    success: false,
    message: "Registratie mislukt.",
  };
}

export async function logoutAction(): Promise<void> {
  await clearAuthSession();
  redirect("/");
}
