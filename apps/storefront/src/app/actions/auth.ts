"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAuthSession,
  createEmailSession,
  getAuthUser,
  persistAuthSession,
  registerEmailUser,
  resolveSupabaseAccessToken,
  sendPasswordResetEmail,
} from "@/lib/auth/session";
import { createPlatformClient } from "@/lib/platform/client";
import { resolvePostAuthRedirectPath } from "@/lib/auth/post-auth";
import { creatorTypesRequiringApproval } from "@/lib/auth/role-request-status";
import {
  ROLE_REQUEST_PENDING_MESSAGE,
} from "@/lib/platform/queries/role-requests";
import {
  REGISTRATION_ALLOWED_INTEREST_TYPES,
  parseRegistrationOfferRoles,
  resolveOfferOnboardingPath,
  type RegistrationInterestType,
} from "@/lib/auth/registration-options";
import { provisionCreatorSeller } from "@/lib/commerce/medusa/creator-registration";
import { completeMerchantOnboarding } from "@/lib/commerce/medusa/merchant-onboarding";
import { persistCreatorRegistrationProfile } from "@/lib/platform/queries/creator-registration";
import {
  getUserRegistrationContext,
  linkUserToSeller,
  persistUserRegistrationProfile,
  runRegistrationCompatibilityMigration,
} from "@/lib/platform/queries/user-registration";
import { ensureMerchantSellerLinked } from "@/lib/commerce/medusa/merchant-seller-link";
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
    const message = error?.toLowerCase().includes("email not confirmed")
      ? "Bevestig eerst je e-mailadres via de link in je inbox, of vraag een nieuwe bevestigingsmail aan."
      : error?.toLowerCase().includes("invalid login credentials")
        ? "Aanmelden mislukt. Controleer je e-mailadres en wachtwoord."
        : "Aanmelden mislukt. Controleer je gegevens of gebruik ‘Wachtwoord vergeten’.";
    return {
      success: false,
      message,
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
    defaultPath: "/profile",
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
  const preferredDomainIds = (formData.getAll("preferred_domain_ids") ?? [])
    .map((value) => value.toString().trim())
    .filter(Boolean);
  const offerRoles = parseRegistrationOfferRoles(
    (formData.getAll("offer_roles") ?? []).map((value) => value.toString())
  );
  const marketingOptIn = formData.get("marketing_opt_in") === "on";
  const offerOnboardingPath = resolveOfferOnboardingPath(offerRoles);
  const requestedNextPath = formData.get("next")?.toString() ?? null;
  const effectiveNextPath =
    requestedNextPath &&
    requestedNextPath.startsWith("/") &&
    !requestedNextPath.startsWith("//")
      ? requestedNextPath
      : offerOnboardingPath;

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
    effectiveNextPath
  );

  if (error) {
    console.error("registerAction signup failed", { email, error });
    const normalized = error.toLowerCase();
    if (normalized.includes("rate limit")) {
      return {
        success: false,
        message:
          "Te veel bevestigingsmails vanaf Hobbysalon (limiet per uur). Wacht ongeveer een uur en probeer opnieuw, of meld je aan als je account al bestaat.",
      };
    }
    if (
      normalized.includes("already") ||
      normalized.includes("user already registered")
    ) {
      return {
        success: false,
        message:
          "Dit e-mailadres is al in gebruik. Meld je aan of gebruik ‘Wachtwoord vergeten’.",
      };
    }
    return {
      success: false,
      message:
        "Registratie mislukt. Controleer je gegevens of probeer het later opnieuw.",
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
      preferredDomainIds,
      offerRoles,
      marketingOptIn,
      marketingConsentSource: marketingOptIn ? "register" : null,
      onboardingCompleted: offerRoles.length === 0,
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
      requestedNextPath: effectiveNextPath,
      defaultPath: offerOnboardingPath ?? "/profile",
    });
    await persistAuthSession(session);
    redirect(redirectPath);
  }

  if (user) {
    const roleLabels = offerRoles.map((role) => {
      if (role === "merchant") return "hobbymaterialenverkoper";
      if (role === "workshopgever") return "workshopgever";
      if (role === "organizer") return "organisator";
      return "maker";
    });
    const offerHint =
      roleLabels.length > 0
        ? ` Na bevestiging rond je je profiel af als ${roleLabels.join(", ")}.`
        : "";

    return {
      success: true,
      message: profilePersisted
        ? `Controleer je e-mail en bevestig je account voordat je inlogt.${offerHint}`
        : `Controleer je e-mail en bevestig je account. Je voorkeuren kun je daarna in je profiel aanvullen.${offerHint}`,
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
      defaultPath: "/profile",
    });
    await persistAuthSession(session);
    redirect(redirectPath);
  }

  if (user) {
    const needsApproval = creatorTypesRequiringApproval(creatorTypes).length > 0;
    const approvalNote = needsApproval
      ? ` ${ROLE_REQUEST_PENDING_MESSAGE}`
      : "";
    return {
      success: true,
      message: profilePersisted && creatorProvisioned
        ? `Controleer je e-mail en bevestig je creator-account voordat je inlogt.${approvalNote}`
        : `Controleer je e-mail en bevestig je account. Daarna kun je je makerprofiel verder instellen.${approvalNote}`,
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
      : "/dashboard";

  let onboarding: Awaited<ReturnType<typeof completeMerchantOnboarding>> | null = null;

  if (registrationUserId) {
    onboarding = await completeMerchantOnboarding({
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
    const redirectPath = onboarding?.pendingApproval
      ? `/dashboard?success=${encodeURIComponent(onboarding.message)}#account`
      : await resolvePostAuthRedirectPath({
          userId: registrationUserId ?? session.user?.id ?? null,
          requestedNextPath,
          defaultPath: "/dashboard",
        });
    await persistAuthSession(session);
    redirect(redirectPath);
  }

  if (user) {
    return {
      success: true,
      message: onboarding?.pendingApproval
        ? `${onboarding.message} Bevestig ook je e-mail voordat je inlogt.`
        : "Controleer je e-mail en bevestig je merchant-account voordat je inlogt.",
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
  const context = await getUserRegistrationContext(user.id);
  const hasMerchantRole = context.roles.includes("merchant");
  const hasMerchantLink = context.sellerLinks.some(
    (link) => link.sellerType === "merchant"
  );

  // Already approved: ensure Medusa merchant seller is linked, then hand off.
  if (hasMerchantRole) {
    if (!hasMerchantLink) {
      const linkResult = await ensureMerchantSellerLinked({
        userId: user.id,
        email,
        displayName,
        contactName,
        phone,
        city,
        postalCode,
        countryCode,
        supabaseAccessToken: accessToken,
      });

      if (!linkResult.ok) {
        return {
          success: false,
          message:
            linkResult.error ??
            "Merchant-winkel koppelen mislukt. Probeer opnieuw.",
        };
      }
    }

    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

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

  revalidatePath("/dashboard");

  redirect(
    `/dashboard?success=${encodeURIComponent(onboarding.message)}#account`
  );
}

export async function updateAccountPreferencesAction(
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

  const result = await persistUserRegistrationProfile({
    userId: user.id,
    postalCode,
    countryCode,
    interestTypes,
  });

  if (!result.ok) {
    return {
      success: false,
      message: "Opslaan van voorkeuren mislukt.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/onboarding");
  revalidatePath("/profile");

  return {
    success: true,
    message: "Voorkeuren opgeslagen.",
  };
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
    defaultPath: "/profile",
  });
  redirect(redirectPath);
}

export async function logoutAction(): Promise<void> {
  await clearAuthSession();
  redirect("/");
}

export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";

  if (!email) {
    return {
      success: false,
      message: "E-mailadres is verplicht.",
    };
  }

  const { error } = await sendPasswordResetEmail(email);

  if (error) {
    console.error("Password reset email failed", { email, error });
  }

  return {
    success: true,
    message:
      "Als er een account bestaat voor dit e-mailadres, ontvang je zo een e-mail met een link om je wachtwoord opnieuw in te stellen. Controleer ook je spamfolder.",
  };
}

export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const user = await getAuthUser();
  if (!user) {
    return {
      success: false,
      message: "Je sessie is verlopen. Vraag een nieuwe resetlink aan.",
    };
  }

  const password = formData.get("password")?.toString() ?? "";
  const requestedNextPath = formData.get("next")?.toString() ?? null;

  if (password.length < 8) {
    return {
      success: false,
      message: "Wachtwoord moet minimaal 8 karakters bevatten.",
    };
  }

  const supabase = createPlatformClient();
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
  });

  if (error) {
    return {
      success: false,
      message: "Wachtwoord opslaan mislukt. Probeer het opnieuw.",
    };
  }

  const redirectPath = await resolvePostAuthRedirectPath({
    userId: user.id,
    requestedNextPath,
    defaultPath: "/profile",
  });
  redirect(redirectPath);
}
