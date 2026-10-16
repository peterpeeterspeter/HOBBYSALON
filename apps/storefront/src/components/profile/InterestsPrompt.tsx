import { saveDiscoveryInterestsAction } from "@/app/actions/interests";
import { REGISTRATION_INTEREST_OPTIONS } from "@/lib/auth/registration-options";

type InterestsPromptProps = {
  error?: string | null;
};

/** One-time question after signup; replaces the interest checkboxes on /register. */
export function InterestsPrompt({ error }: InterestsPromptProps) {
  return (
    <section
      aria-labelledby="interesses-vraag-titel"
      className="mb-8 rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <h2
        id="interesses-vraag-titel"
        className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]"
      >
        Wat wil je vooral ontdekken?
      </h2>
      <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
        Kies wat je leuk vindt. Dan tonen we je eerst wat daarbij past. Je kunt
        dit later altijd aanpassen.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
        >
          {error}
        </p>
      ) : null}

      <form action={saveDiscoveryInterestsAction} className="mt-5">
        <fieldset>
          <legend className="sr-only">Interesses</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {REGISTRATION_INTEREST_OPTIONS.map((interest) => (
              <label
                key={interest.value}
                className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 transition hover:border-[var(--accent)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent)]/5"
              >
                <input
                  type="checkbox"
                  name="interest_types"
                  value={interest.value}
                  className="mt-1 size-6 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-[var(--foreground)]">
                    {interest.label}
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-[var(--muted)]">
                    {interest.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="min-h-12 rounded-xl bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Bewaar
          </button>
          <button
            type="submit"
            name="skip"
            value="1"
            formNoValidate
            className="min-h-12 rounded-xl px-4 text-base font-medium text-[var(--muted)] underline underline-offset-4 hover:text-[var(--foreground)]"
          >
            Overslaan
          </button>
        </div>
      </form>
    </section>
  );
}
