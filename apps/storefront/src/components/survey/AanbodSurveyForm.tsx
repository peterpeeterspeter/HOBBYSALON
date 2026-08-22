"use client";

import { useEffect, useMemo, useState } from "react";
import { submitAanbodSurveyAction } from "@/app/actions/survey";
import { SurveyQuestionField } from "@/components/survey/SurveyFields";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics/track";
import {
  CLOSING_QUESTIONS,
  SHARED_QUESTIONS,
  buildSurveySteps,
  getRoleSection,
  getStepTitle,
  type ActivityType,
  type SurveyAnswers,
  type SurveyStep,
} from "@/lib/survey/aanbod-verbeteren";
import {
  createEmptySurveyAnswers,
  validateSurveyAnswers,
} from "@/lib/survey/validate-survey";

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function validateStep(step: SurveyStep, answers: SurveyAnswers): string | null {
  if (step.kind === "intro") {
    if (answers.activity_types.length === 0) {
      return "Selecteer minstens één rol.";
    }
    return null;
  }

  if (step.kind === "shared") {
    if (!answers.activity_status) {
      return "Geef aan of u vandaag al actief bent met dit aanbod.";
    }
    if (answers.outcomes.length === 0) {
      return "Kies minstens één doel voor Hobbysalon.";
    }
    if (answers.outcomes.length > 2) {
      return "Kies maximaal 2 doelen.";
    }
    if (answers.outcomes.includes("anders") && !answers.outcomes_other?.trim()) {
      return "Vul de toelichting bij 'Anders' in.";
    }
    return null;
  }

  if (step.kind === "role") {
    const section = getRoleSection(step.activityType);
    if (!section) return null;
    const roleAnswers = answers.roles[step.activityType] ?? {};
    for (const question of section.questions) {
      const value = roleAnswers[question.id];
      const otherKey = `${question.id}_other`;
      const otherValue = asOptionalString(roleAnswers[otherKey]);

      if (question.kind === "multi") {
        const values = Array.isArray(value) ? value : [];
        if (question.maxSelections && values.length > question.maxSelections) {
          return `Kies maximaal ${question.maxSelections} antwoorden.`;
        }
        const otherOption = question.options?.find((option) => option.other);
        if (otherOption && values.includes(otherOption.value) && !otherValue?.trim()) {
          return "Vul de toelichting bij 'Anders' in.";
        }
      }

      if ((question.kind === "single" || question.kind === "scale") && !String(value ?? "").trim()) {
        return `"${question.label}" is verplicht.`;
      }
    }
    return null;
  }

  if (step.kind === "closing") {
    if (answers.closing.contact_ok !== "ja" && answers.closing.contact_ok !== "nee") {
      return "Geef aan of we u mogen contacteren.";
    }
    if (answers.closing.contact_ok === "ja") {
      const email = answers.closing.contact_email?.trim() ?? "";
      if (!email) return "E-mailadres is verplicht wanneer u contact wilt.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "Ongeldig e-mailadres.";
      }
    }
    return null;
  }

  return null;
}

export function AanbodSurveyForm() {
  const [answers, setAnswers] = useState<SurveyAnswers>(createEmptySurveyAnswers);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  const steps = useMemo(
    () => buildSurveySteps(answers.activity_types),
    [answers.activity_types]
  );

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(steps.length - 1, 0));
    }
  }, [stepIndex, steps.length]);

  const currentStep = steps[stepIndex] ?? steps[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  function updateRoleAnswer(activityType: ActivityType, questionId: string, value: unknown) {
    setAnswers((prev) => ({
      ...prev,
      roles: {
        ...prev.roles,
        [activityType]: {
          ...(prev.roles[activityType] ?? {}),
          [questionId]: value,
        },
      },
    }));
  }

  function goNext() {
    const stepError = validateStep(currentStep, answers);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError("");
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  function goBack() {
    setError("");
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  async function handleSubmit() {
    const stepError = validateStep(currentStep, answers);
    if (stepError) {
      setError(stepError);
      return;
    }

    const fullError = validateSurveyAnswers(answers);
    if (fullError) {
      setError(fullError);
      return;
    }

    setStatus("submitting");
    setError("");

    const result = await submitAanbodSurveyAction(answers);

    if (result.success) {
      trackEvent("survey_submitted", {
        survey_key: "aanbod-verbeteren-2026",
        activity_types: answers.activity_types.join(","),
      });
      setStatus("success");
      return;
    }

    setStatus("idle");
    setError(result.message ?? "Verzenden mislukt. Probeer het later opnieuw.");
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/30">
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-green-800 dark:text-green-200">
          Bedankt voor uw antwoorden
        </h2>
        <p className="mt-2 text-base leading-relaxed text-green-700 dark:text-green-300">
          Uw enquête is succesvol ontvangen. We gebruiken uw feedback om het aanbod van Hobbysalon te verbeteren.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <p className="text-sm font-semibold text-[var(--accent)]">
          Stap {stepIndex + 1} van {steps.length}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
          {getStepTitle(currentStep)}
        </h2>
      </div>

      {currentStep.kind === "intro" ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--section-highlight)]/50 p-5 text-base leading-relaxed text-[var(--muted)]">
            <p>
              Hobbysalon brengt creatieve workshops, makers, materialen, tutorials en evenementen samen op één platform.
            </p>
            <p className="mt-3">
              Met deze enquête onderzoeken we welke functies creatieve aanbieders nodig hebben en welke prijsmodellen haalbaar zijn. Uw antwoorden worden uitsluitend gebruikt om het aanbod van Hobbysalon te verbeteren.
            </p>
            <p className="mt-3 font-medium text-[var(--foreground)]">Invullen duurt ongeveer 3 tot 5 minuten.</p>
          </div>
          <SurveyQuestionField
            question={SHARED_QUESTIONS.activityTypes}
            value={answers.activity_types}
            onSingleChange={() => {}}
            onMultiChange={(values) =>
              setAnswers((prev) => ({
                ...prev,
                activity_types: values as ActivityType[],
              }))
            }
            disabled={status === "submitting"}
          />
        </div>
      ) : null}

      {currentStep.kind === "shared" ? (
        <div className="space-y-8">
          <SurveyQuestionField
            question={SHARED_QUESTIONS.activityStatus}
            value={answers.activity_status}
            onSingleChange={(value) =>
              setAnswers((prev) => ({ ...prev, activity_status: value }))
            }
            onMultiChange={() => {}}
            disabled={status === "submitting"}
          />
          <SurveyQuestionField
            question={SHARED_QUESTIONS.outcomes}
            value={answers.outcomes}
            otherValue={answers.outcomes_other}
            onSingleChange={() => {}}
            onMultiChange={(values) =>
              setAnswers((prev) => ({ ...prev, outcomes: values }))
            }
            onOtherChange={(value) =>
              setAnswers((prev) => ({ ...prev, outcomes_other: value }))
            }
            disabled={status === "submitting"}
          />
        </div>
      ) : null}

      {currentStep.kind === "role" ? (
        <div className="space-y-8">
          {getRoleSection(currentStep.activityType)?.description ? (
            <p className="text-base text-[var(--muted)]">
              {getRoleSection(currentStep.activityType)?.description}
            </p>
          ) : null}
          {getRoleSection(currentStep.activityType)?.questions.map((question) => {
            const roleAnswers = answers.roles[currentStep.activityType] ?? {};
            const otherKey = `${question.id}_other`;
            return (
              <SurveyQuestionField
                key={question.id}
                question={question}
                value={roleAnswers[question.id]}
                otherValue={asOptionalString(roleAnswers[otherKey]) ?? ""}
                onSingleChange={(value) =>
                  updateRoleAnswer(currentStep.activityType, question.id, value)
                }
                onMultiChange={(values) =>
                  updateRoleAnswer(currentStep.activityType, question.id, values)
                }
                onOtherChange={(value) =>
                  updateRoleAnswer(currentStep.activityType, otherKey, value)
                }
                disabled={status === "submitting"}
              />
            );
          })}
        </div>
      ) : null}

      {currentStep.kind === "closing" ? (
        <div className="space-y-8">
          {CLOSING_QUESTIONS.map((question) => {
            if (question.id === "contact_name" || question.id === "contact_email") {
              if (answers.closing.contact_ok !== "ja") return null;
            }

            const value =
              question.id === "missing"
                ? answers.closing.missing ?? ""
                : question.id === "contact_ok"
                  ? answers.closing.contact_ok
                  : question.id === "contact_name"
                    ? answers.closing.contact_name ?? ""
                    : answers.closing.contact_email ?? "";

            return (
              <SurveyQuestionField
                key={question.id}
                question={{
                  ...question,
                  required:
                    question.id === "contact_email"
                      ? answers.closing.contact_ok === "ja"
                      : question.required,
                }}
                value={value}
                onSingleChange={(nextValue) =>
                  setAnswers((prev) => ({
                    ...prev,
                    closing: {
                      ...prev.closing,
                      [question.id]: nextValue,
                    },
                  }))
                }
                onMultiChange={() => {}}
                disabled={status === "submitting"}
              />
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {!isFirst ? (
          <Button type="button" variant="secondary" onClick={goBack} disabled={status === "submitting"}>
            Vorige
          </Button>
        ) : null}
        {!isLast ? (
          <Button type="button" onClick={goNext} disabled={status === "submitting"}>
            Volgende
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={status === "submitting"}>
            {status === "submitting" ? "Bezig met verzenden…" : "Enquête versturen"}
          </Button>
        )}
      </div>
    </div>
  );
}
