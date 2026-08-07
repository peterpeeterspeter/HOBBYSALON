import {
  ACTIVITY_TYPES,
  CLOSING_QUESTIONS,
  ROLE_SECTIONS,
  SHARED_QUESTIONS,
  type ActivityType,
  type SurveyAnswers,
  type SurveyQuestion,
} from "@/lib/survey/aanbod-verbeteren";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isActivityType(value: string): value is ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(value);
}

function validateQuestion(question: SurveyQuestion, value: unknown, otherValue?: string): string | null {
  if (question.kind === "multi") {
    const values = Array.isArray(value) ? value : [];
    if (question.required && values.length === 0) {
      return `"${question.label}" is verplicht.`;
    }
    if (question.maxSelections && values.length > question.maxSelections) {
      return `Kies maximaal ${question.maxSelections} antwoorden bij "${question.label}".`;
    }
    const otherOption = question.options?.find((option) => option.other);
    if (otherOption && values.includes(otherOption.value) && !otherValue?.trim()) {
      return "Vul de toelichting bij 'Anders' in.";
    }
    return null;
  }

  if (question.kind === "single" || question.kind === "scale") {
    if (question.required !== false && !String(value ?? "").trim()) {
      return `"${question.label}" is verplicht.`;
    }
    const otherOption = question.options?.find((option) => option.other);
    if (otherOption && value === otherOption.value && !otherValue?.trim()) {
      return "Vul de toelichting bij 'Anders' in.";
    }
    return null;
  }

  if (question.id === "contact_email" && String(value ?? "").trim() && !EMAIL_RE.test(String(value))) {
    return "Ongeldig e-mailadres.";
  }

  return null;
}

export function validateSurveyAnswers(answers: SurveyAnswers): string | null {
  const activityTypes = answers.activity_types.filter(isActivityType);
  if (activityTypes.length === 0) {
    return "Selecteer minstens één rol.";
  }

  const invalidType = answers.activity_types.find((type) => !isActivityType(type));
  if (invalidType) {
    return "Ongeldige rol geselecteerd.";
  }

  const statusError = validateQuestion(SHARED_QUESTIONS.activityStatus, answers.activity_status);
  if (statusError) return statusError;

  const outcomesError = validateQuestion(
    SHARED_QUESTIONS.outcomes,
    answers.outcomes,
    answers.outcomes_other
  );
  if (outcomesError) return outcomesError;

  for (const activityType of activityTypes) {
    const section = ROLE_SECTIONS.find((item) => item.activityType === activityType);
    if (!section) continue;
    const roleAnswers = answers.roles[activityType] ?? {};
    for (const question of section.questions) {
      const otherKey = `${question.id}_other`;
      const error = validateQuestion(
        question,
        roleAnswers[question.id],
        asOptionalString(roleAnswers[otherKey])
      );
      if (error) return error;
    }
  }

  const extraRoleKeys = Object.keys(answers.roles).filter(
    (key) => !activityTypes.includes(key as ActivityType)
  );
  if (extraRoleKeys.length > 0) {
    return "Antwoorden voor niet-geselecteerde rollen zijn niet toegestaan.";
  }

  const contactOk = answers.closing.contact_ok;
  if (contactOk !== "ja" && contactOk !== "nee") {
    return "Geef aan of we u mogen contacteren.";
  }

  if (contactOk === "ja") {
    const email = answers.closing.contact_email?.trim() ?? "";
    if (!email) {
      return "E-mailadres is verplicht wanneer u contact wilt.";
    }
    if (!EMAIL_RE.test(email)) {
      return "Ongeldig e-mailadres.";
    }
  }

  return null;
}

export function buildSurveyInsertPayload(answers: SurveyAnswers) {
  const activityTypes = answers.activity_types.filter(isActivityType);
  const roleAnswers: Record<string, Record<string, unknown>> = {};

  for (const activityType of activityTypes) {
    roleAnswers[activityType] = { ...(answers.roles[activityType] ?? {}) };
  }

  const answersJson = {
    shared: {
      outcomes_other: answers.outcomes_other ?? null,
    },
    ...roleAnswers,
    closing: answers.closing,
  };

  return {
    survey_key: "aanbod-verbeteren-2026",
    activity_types: activityTypes,
    activity_status: answers.activity_status,
    outcomes: answers.outcomes,
    answers: answersJson,
    contact_ok: answers.closing.contact_ok === "ja",
    contact_name: answers.closing.contact_name?.trim() || null,
    contact_email:
      answers.closing.contact_ok === "ja"
        ? answers.closing.contact_email?.trim() || null
        : null,
    status: "new" as const,
  };
}

export function createEmptySurveyAnswers(): SurveyAnswers {
  return {
    activity_types: [],
    activity_status: "",
    outcomes: [],
    roles: {},
    closing: {
      contact_ok: "nee",
      contact_name: "",
      contact_email: "",
      missing: "",
    },
  };
}
