"use server";

import { createPlatformClient } from "@/lib/platform/client";
import { getAuthUser } from "@/lib/auth/session";
import type { SurveyAnswers } from "@/lib/survey/aanbod-verbeteren";
import {
  buildSurveyInsertPayload,
  validateSurveyAnswers,
} from "@/lib/survey/validate-survey";

export type SurveySubmitResult = {
  success: boolean;
  message?: string;
};

export async function submitAanbodSurveyAction(
  answers: SurveyAnswers
): Promise<SurveySubmitResult> {
  const validationError = validateSurveyAnswers(answers);
  if (validationError) {
    return { success: false, message: validationError };
  }

  const payload = buildSurveyInsertPayload(answers);
  const user = await getAuthUser();

  try {
    const supabase = createPlatformClient();
    const { error } = await supabase.from("survey_responses").insert({
      ...payload,
      user_id: user?.id ?? null,
    });

    if (error) {
      console.error("Survey response insert failed:", error);
      return {
        success: false,
        message: "Verzenden mislukt. Probeer het later opnieuw.",
      };
    }

    return {
      success: true,
      message: "Bedankt voor uw antwoorden.",
    };
  } catch (err) {
    console.error("Survey response submit error:", err);
    return {
      success: false,
      message: "Verzenden mislukt. Probeer het later opnieuw.",
    };
  }
}
