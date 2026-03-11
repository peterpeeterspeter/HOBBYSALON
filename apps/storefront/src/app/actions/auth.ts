"use server";

import { redirect } from "next/navigation";
import {
  clearAuthSession,
  createEmailSession,
  persistAuthSession,
  registerEmailUser,
} from "@/lib/auth/session";

export type AuthActionState = {
  success: boolean;
  message: string;
};

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

  if (session) {
    await persistAuthSession(session);
    redirect(nextPath);
  }

  if (user) {
    return {
      success: true,
      message:
        "Account aangemaakt. Bevestig je e-mail indien vereist en meld je daarna aan.",
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
