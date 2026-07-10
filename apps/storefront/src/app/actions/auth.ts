"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearAuthSession,
  createEmailSession,
  getAuthUser,
  persistAuthSession,
  registerEmailUser,
  resolveSupabaseAccessToken,
} from "@/lib/auth/session";
import { resolvePostAuthRedirectPath } from "@/lib/auth/post-auth";
import {
  REGISTRATION_ALLOWED_INTEREST_TYPES,
  type RegistrationInterestType,
} from "@/lib/auth/registration-options";
import { provisionCreatorSeller } from "@/lib/commerce/medusa/creator-registration";
import { completeMerchantOnboarding } from "@/lib/commerce/medusa/merchant-onboarding";
import { persistCreatorRegistrationProfile } from "@/lib/platform/queries/creator-registration";
import {
  linkUserToSeller,
  persistUserRegistrationProfile,
  runRegistrationCompatibilityMigration,
} from "@/lib/platform/queries/user-registration";
import {
  LOCATION_CITY_COOKIE,
  LOCATION_COUNTRY_COOKIE,
  sanitizeLocationCity,
  sanitizeLocationCountryCode,
} from "@/lib/location/preference";

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
  const requestedNextPath = formData.get("next")?.toString() ?? null;

  if (!email || !password) {
    return {
      success: false,
      message: "E-mail en wachtwoord zijn verplicht.",
    };
  }

  const { user, session, error } = await createEmailSession(email, password);

  if (error || !session) {
    return {
      success: false,
      message: "Aanmelden mislukt. Controleer je gegevens.",
    };
  }

  const registrationUserId = user?.id ?? session.user?.id ?? null;
  if (registrationUserId) {
    const cookieStore = await cookies();
    const compatibilityResult = await runRegistrationCompatibilityMigration({
      userId: registrationUserId,
      email: user?.email ?? session.user?.email ?? email,
      legacyCity: sanitizeLocationCity(
        cookieStore.get(LOCATION_CITY_COOKIE)?.value ?? null
      ),
      legacyCountryCode: sanitizeLocationCountryCode(
        cookieStore.get(LOCATION_COUNTRY_COOKIE)?.value ?? null
      ),
    });

    if (!compatibilityResult.ok) {
      console.error("Failed to run registration compatibility migration", {
        userId: registrationUserId,
        errors: compatibilityResult.errors,
      });
    }
  }

  const redirectPath = await resolvePostAuthRedirectPath({
    userId: registrationUserId,
    requestedNextPath,
    defaultPath: "/",
  });

  await persistAuthSession(session);
  redirect(redirectPath);
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
  const requestedNextPath = formData.get("next")?.toString() ?? null;

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

  const { session, user, error } = await registerEmailUser(
    email,
    password,
    requestedNextPath
  );

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
    const redirectPath = await resolvePostAuthRedirectPath({
      userId: registrationUserId ?? session.user?.id ?? null,
      requestedNextPath,
      defaultPath: "/",
    });
    await persistAuthSession(session);
    redirect(redirectPath);
  }

  if (user) {
    return {
      success: true,
      message: profilePersisted
        ? "Controleer je e-mail en bevestig je account voordat je inlogt."
        : "Controleer je e-mail en bevestig je account. Je voorkeuren kun je daarna in je profiel aanvullen.",
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
  const requestedNextPath = formData.get("next")?.toString() ?? null;

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

  const { session, user, error } = await registerEmailUser(
    email,
    password,
    requestedNextPath,
    {
      account_type: "creator",
      display_name: displayName,
      business_name: businessName,
      preferred_slug: preferredSlug,
      city,
      postal_code: postalCode,
      country_code: countryCode,
      interest_types: interestTypes,
      creator_types: creatorTypes,
    }
  );

  if (error) {
    return {
      success: false,
      message: "Registratie mislukt. Gebruik een ander e-mailadres.",
    };
  }

  let profilePersisted = true;
  let creatorProvisioned = false;
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

    const creatorResult = await provisionCreatorSeller({
      displayName,
      businessName: businessName?.trim() || displayName,
      contactName: displayName,
      email,
      city,
      postalCode,
      countryCode,
    });

    if (!creatorResult.ok || !creatorResult.sellerId) {
      console.error("Failed to provision creator seller", {
        userId: registrationUserId,
        error: creatorResult.error,
      });
    } else {
      creatorProvisioned = true;
      const sellerLinkResult = await linkUserToSeller(
        registrationUserId,
        creatorResult.sellerId,
        "creator"
      );

      if (!sellerLinkResult.ok) {
        creatorProvisioned = false;
        console.error("Failed to link user to creator seller", {
          userId: registrationUserId,
          sellerId: creatorResult.sellerId,
          errors: sellerLinkResult.errors,
        });
      }
    }
  }

  if (session) {
    const redirectPath = await resolvePostAuthRedirectPath({
      userId: registrationUserId ?? session.user?.id ?? null,
      requestedNextPath,
      defaultPath: "/dashboard/creator",
    });
    await persistAuthSession(session);
    redirect(redirectPath);
  }

  if (user) {
    return {
      success: true,
      message: profilePersisted && creatorProvisioned
        ? "Controleer je e-mail en bevestig je creator-account voordat je inlogt."
        : "Controleer je e-mail en bevestig je account. Daarna kun je je creatorshop verder instellen in je dashboard.",
    };
  }

  return {
    success: false,
    message: "Registratie mislukt.",
  };
}

export async function registerMerchantAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const displayName = formData.get("display_name")?.toString().trim() ?? "";
  const contactName = formData.get("contact_name")?.toString() ?? null;
  const phone = formData.get("phone")?.toString() ?? null;
  const city = formData.get("city")?.toString() ?? null;
  const postalCode = formData.get("postal_code")?.toString() ?? null;
  const countryCode = formData.get("country_code")?.toString() ?? null;
  const interestTypes = parseInterestTypes(formData);
  const requestedNextPath = formData.get("next")?.toString() ?? null;

  if (!displayName) {
    return {
      success: false,
      message: "Handelsnaam is verplicht.",
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

  const { session, user, error } = await registerEmailUser(
    email,
    password,
    requestedNextPath
  );

  if (error) {
    return {
      success: false,
      message: "Registratie mislukt. Gebruik een ander e-mailadres.",
    };
  }

  const registrationUserId = user?.id ?? session?.user?.id ?? null;
  const nextPath =
    requestedNextPath?.startsWith("/") && !requestedNextPath.startsWith("//")
      ? requestedNextPath
      : "/dashboard/materials";

  if (registrationUserId) {
    const onboarding = await completeMerchantOnboarding({
      userId: registrationUserId,
      displayName,
      contactName,
      email,
      phone,
      city,
      postalCode,
      countryCode,
      interestTypes,
      supabaseAccessToken: session?.access_token ?? null,
    });

    if (!onboarding.ok) {
      if (session) {
        await persistAuthSession(session);
        redirect(
          `/register/merchant?error=${encodeURIComponent(onboarding.message)}&next=${encodeURIComponent(nextPath)}`
        );
      }

      return {
        success: false,
        message: onboarding.message,
      };
    }
  }

  if (session) {
    const redirectPath = await resolvePostAuthRedirectPath({
      userId: registrationUserId ?? session.user?.id ?? null,
      requestedNextPath,
      defaultPath: "/dashboard/materials",
    });
    await persistAuthSession(session);
    redirect(redirectPath);
  }

  if (user) {
    return {
      success: true,
      message:
        "Controleer je e-mail en bevestig je merchant-account voordat je inlogt.",
    };
  }

  return {
    success: false,
    message: "Registratie mislukt.",
  };
}

export async function onboardMerchantForLoggedInUserAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const user = await getAuthUser();
  if (!user) {
    return {
      success: false,
      message: "Meld je eerst aan.",
    };
  }

  const email = user.email?.trim().toLowerCase() ?? "";
  const displayName = formData.get("display_name")?.toString().trim() ?? "";
  const contactName = formData.get("contact_name")?.toString() ?? null;
  const phone = formData.get("phone")?.toString() ?? null;
  const city = formData.get("city")?.toString() ?? null;
  const postalCode = formData.get("postal_code")?.toString() ?? null;
  const countryCode = formData.get("country_code")?.toString() ?? null;
  const interestTypes = parseInterestTypes(formData);
  const requestedNextPath = formData.get("next")?.toString() ?? null;

  if (!displayName) {
    return {
      success: false,
      message: "Handelsnaam is verplicht.",
    };
  }

  if (!email) {
    return {
      success: false,
      message: "Je account heeft geen geldig e-mailadres.",
    };
  }

  const accessToken = await resolveSupabaseAccessToken();
  const onboarding = await completeMerchantOnboarding({
    userId: user.id,
    displayName,
    contactName,
    email,
    phone,
    city,
    postalCode,
    countryCode,
    interestTypes,
    supabaseAccessToken: accessToken,
  });

  if (!onboarding.ok) {
    return {
      success: false,
      message: onboarding.message,
    };
  }

  const redirectPath = await resolvePostAuthRedirectPath({
    userId: user.id,
    requestedNextPath,
    defaultPath: "/dashboard/materials",
  });
  redirect(redirectPath);
}

export async function completeRegistrationProfileAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const user = await getAuthUser();
  if (!user) {
    return {
      success: false,
      message: "Meld je eerst aan.",
    };
  }

  const postalCode = formData.get("postal_code")?.toString() ?? null;
  const countryCode = formData.get("country_code")?.toString() ?? null;
  const interestTypes = parseInterestTypes(formData);
  const requestedNextPath = formData.get("next")?.toString() ?? null;

  const result = await persistUserRegistrationProfile({
    userId: user.id,
    postalCode,
    countryCode,
    interestTypes,
  });

  if (!result.ok) {
    return {
      success: false,
      message: "Opslaan van onboardingvoorkeuren mislukt.",
    };
  }

  const redirectPath = await resolvePostAuthRedirectPath({
    userId: user.id,
    requestedNextPath,
    defaultPath: "/",
  });
  redirect(redirectPath);
}

export async function logoutAction(): Promise<void> {
  await clearAuthSession();
  redirect("/");
}
