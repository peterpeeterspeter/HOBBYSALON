# Simplify registration: one plain account form, separate aanbieder path

> **For Hermes:** Implement phase by phase on a fresh branch. Commit and push after each phase (the Vercel preview is the build gate). Use test-driven-development for every task that has a test.

**Goal:** `/register` becomes a short, single-purpose form for hobbyists (about 90% of signups). People who want to offer something take a separate path, one link away.

**Architecture:** Replace `RegisterIntentForm` with a small `RegisterForm` (email, password, optional postcode, newsletter opt-in). Hobbyists don't see professional roles. A new chooser at `/register/aanbieden` sends workshopgevers, makers and organisatoren to the same simple form with a hidden `offer_roles` value. After email confirmation the existing `/onboarding` flow collects their profile. Merchants keep `/register/merchant`. Interests move out of signup into a one-time prompt on `/profile`.

**Tech stack:** Next.js 16 app router, React 19 server actions, Supabase auth, `node --test` for pure helpers, vitest (`*.vitest.spec.ts`) for module-mocked server code.

**Branch:** `ux/register-simplify` from `origin/main`. If `ux/dashboard-simplify` isn't merged yet, wait for it. Its commits touch `/dashboard/pagina` redirects that this plan relies on.

---

## 1. Current state (from code; the live render wasn't checked because the browser backend was unavailable)

| # | Problem | Evidence |
|---|---------|----------|
| 1 | "Ik wil ontdekken" and "Ik wil iets aanbieden" are two **checkboxes**. Users can tick both or neither, and the form still submits. "Ontdekken" only shows or hides the interests block and has no effect on the account. | `components/auth/RegisterIntentForm.tsx:183-207` |
| 2 | Default state has **12 controls** before the button (2 intent cards, 5 interests, email, password, postcode, land, newsletter). That rises to **21** when "Tutorials" is ticked (8 hobby chips plus "Alle"), and adds 4 role checkboxes when "aanbieden" is ticked. | `RegisterIntentForm.tsx:123,216,261,358-443` |
| 3 | Professional roles (Workshopgever, Maker, Organisator, Hobbymaterialenverkoper) appear inside the hobbyist form. | `RegisterIntentForm.tsx:251-292` |
| 4 | "Gratis account. Geen abonnement. Je zit nergens aan vast." appears 3 times. | `register/page.tsx:96`, `RegisterIntentForm.tsx:354,463` |
| 5 | Small type for a 55+ audience: labels use `text-sm`, the postcode hint uses `text-xs`, and there's no show-password option. | `RegisterIntentForm.tsx:359,400` |
| 6 | After a successful submit, the form and button stay on screen. Users press again and hit the Supabase hourly email limit (the action already has a message for exactly that). | `RegisterIntentForm.tsx:445-460`, `actions/auth.ts:225-231` |
| 7 | `/login` shows 4 large aanbieder cards and **no** "maak een gewoon account" link. The member link only renders when `current` is set. | `login/page.tsx:63`, `AccountChoiceCards.tsx:129` |
| 8 | There are two parallel creator signups. `/register/creator` is a long form (name, bedrijfsnaam, "Slug", stad, postcode, land, 5 role checkboxes, interests, English "Creator-account"). `/register` with an offer role leads to `/onboarding`, which then asks name, city, bio and hobby again. | `CreatorRegisterForm.tsx`, `onboarding/page.tsx:202-316` |
| 9 | **Bug (consent/data loss):** `persistUserRegistrationProfile` always writes `marketing_opt_in`, `offer_roles`, `primary_offer_role` and `onboarding_completed`, even when the caller leaves them out. A logged-in hobbyist who upgrades to merchant, or saves "Voorkeuren", loses their newsletter opt-in and offer intent. | `lib/platform/queries/user-registration.ts:178-193`, called from `merchant-onboarding.ts:26-31` and `actions/auth.ts:803-808` |

To check the 90% assumption before and after, run this read-only query:

```sql
select cardinality(offer_roles) > 0 as wants_to_offer, count(*)
from user_preferences
where created_at > now() - interval '90 days'
group by 1;
```

## 2. Target UX

**`/register` (hobbyist, default):**

```
Maak je gratis account
Bewaar favorieten, schrijf je in voor workshops en vind activiteiten in je buurt.

E-mailadres            [______________________]
Wachtwoord             [______________________] [Toon]
                       Minstens 8 tekens.
Postcode (optioneel)   [________]
                       Dan tonen we workshops en evenementen in je buurt.
[ ] Stuur mij af en toe inspiratie en nieuws. Je kunt dit altijd uitzetten.
[Turnstile]
[        Gratis account maken        ]
Gratis, geen abonnement. Al een account? Meld je aan.

Wil je zelf workshops geven, creaties verkopen of een evenement organiseren?
Meld je aan als aanbieder  >
```

After a successful submit, the form is replaced by: "Kijk in je mailbox. We stuurden een bevestigingsmail naar **x@y.be**. Klik op de knop in die mail om je account te activeren. Niets ontvangen? Kijk ook bij Spam of Ongewenst."

**`/register/aanbieden` (chooser):** four large task cards ("Workshops geven", "Mijn creaties tonen en verkopen", "Een markt of evenement organiseren", "Mijn winkel of materialen aanbieden") and a link: "Alleen ontdekken? Maak een gewoon account."

**`/register/creator?focus=X`:** the same simple form under a role-specific heading. After confirmation, the existing `/onboarding` asks name, city, bio and hobby, then the first listing.

**Click count:** hobbyist 1 page. Aanbieder: `/register`, then `/register/aanbieden`, then the role form (3).

Copy rules: Dutch, no em-dashes, one "gratis" line, labels `text-base`, helper text `text-sm`, inputs `min-h-12`.

Field names stay as they are (`email`, `password`, `postal_code`, `marketing_opt_in`, `next`, `offer_roles`, `cf-turnstile-response`), so autofill and `registerAction` keep working.

---

## Phase 0: Fix the partial-write bug (about 1h)

### Task 0.1: Reproduce with a failing test

**Create:** `apps/storefront/src/lib/platform/queries/user-registration.partial-write.vitest.spec.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  upserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
}));

vi.mock("../client", () => ({
  createPlatformClient() {
    return {
      from(table: string) {
        return {
          async upsert(payload: Record<string, unknown>) {
            h.upserts.push({ table, payload });
            return { error: null };
          },
        };
      },
    };
  },
}));

import { persistUserRegistrationProfile } from "./user-registration";

const prefPayload = () =>
  h.upserts.find((u) => u.table === "user_preferences")!.payload;

describe("persistUserRegistrationProfile partial writes", () => {
  beforeEach(() => {
    h.upserts.length = 0;
  });

  it("leaves consent and offer intent alone when the caller omits them", async () => {
    await persistUserRegistrationProfile({
      userId: "u1",
      postalCode: "2800",
      countryCode: "BE",
      interestTypes: ["supply"],
    });
    const pref = prefPayload();
    expect(pref).not.toHaveProperty("marketing_opt_in");
    expect(pref).not.toHaveProperty("offer_roles");
    expect(pref).not.toHaveProperty("primary_offer_role");
    expect(pref).not.toHaveProperty("onboarding_completed");
  });

  it("only writes interests when that is all the caller passes", async () => {
    await persistUserRegistrationProfile({ userId: "u1", interestTypes: ["workshop"] });
    expect(prefPayload()).toEqual({ user_id: "u1", interest_types: ["workshop"] });
  });

  it("still writes everything registerAction passes", async () => {
    await persistUserRegistrationProfile({
      userId: "u1",
      postalCode: "2800",
      countryCode: "BE",
      interestTypes: [],
      offerRoles: ["maker"],
      marketingOptIn: true,
      marketingConsentSource: "register",
      onboardingCompleted: false,
    });
    expect(prefPayload()).toMatchObject({
      offer_roles: ["maker"],
      primary_offer_role: "maker",
      marketing_opt_in: true,
      marketing_consent_source: "register",
      onboarding_completed: false,
    });
  });
});
```

Run: `cd apps/storefront && ./node_modules/.bin/vitest run src/lib/platform/queries/user-registration.partial-write.vitest.spec.ts`
Expected: tests 1 and 2 FAIL (the keys are present), test 3 passes.

### Task 0.2: Write only the fields the caller provides

**Modify:** `apps/storefront/src/lib/platform/queries/user-registration.ts:159-203`. Replace the payload construction with:

```ts
  const nowIso = new Date().toISOString();
  const preferencePayload: Record<string, unknown> = { user_id: input.userId };

  if (input.postalCode !== undefined) {
    preferencePayload.postal_code = sanitizePostalCode(input.postalCode);
  }
  if (input.countryCode !== undefined) {
    preferencePayload.country_code = sanitizeCountryCode(input.countryCode);
  }
  if (input.interestTypes !== undefined) {
    preferencePayload.interest_types = sanitizeInterestTypes(input.interestTypes);
  }
  if (input.preferredDomainIds !== undefined) {
    preferencePayload.preferred_domain_ids = sanitizePreferredDomainIds(
      input.preferredDomainIds
    );
  }
  if (input.offerRoles !== undefined) {
    const offerRoles = sanitizeOfferRoles(input.offerRoles);
    preferencePayload.offer_roles = offerRoles;
    preferencePayload.primary_offer_role =
      input.primaryOfferRole !== undefined
        ? input.primaryOfferRole
        : resolvePrimaryOfferRole(offerRoles);
  }
  if (input.onboardingCompleted !== undefined) {
    preferencePayload.onboarding_completed = input.onboardingCompleted;
  }
  if (input.marketingOptIn !== undefined) {
    preferencePayload.marketing_opt_in = input.marketingOptIn;
    if (input.marketingOptIn) {
      preferencePayload.marketing_opted_in_at = nowIso;
      preferencePayload.marketing_consent_source =
        input.marketingConsentSource?.trim() || "register";
    }
  }
```

Remove the now-unused locals (`postalCode`, `countryCode`, `interestTypes`, `preferredDomainIds`, `offerRoles`, `primaryOfferRole`, `marketingOptIn`, `onboardingCompleted`). Leave the `user_account_roles` upsert unchanged.

Behaviour note: new merchant and creator rows now get the DB default `onboarding_completed = false` instead of `true`. That's harmless because `post-auth.ts:47-60` checks merchant role/link first and only uses `onboardingCompleted` when `offer_roles` is non-empty.

Run the spec again: 3 passed. Then run `yarn test` and `./node_modules/.bin/vitest run`, both green.
Commit: `fix(registration): stop wiping newsletter consent and offer intent on partial profile saves`

---

## Phase 1: Plain hobbyist `/register` (about 3h)

### Task 1.1: Country from postcode (pure, tested)

**Test first:** append to `apps/storefront/src/lib/auth/registration-options.test.ts`:

```ts
import { inferCountryFromPostalCode } from "./registration-options";

test("inferCountryFromPostalCode: NL only with letters, else BE", () => {
  assert.equal(inferCountryFromPostalCode("2800"), "BE");
  assert.equal(inferCountryFromPostalCode("1012 AB"), "NL");
  assert.equal(inferCountryFromPostalCode("1012ab"), "NL");
  assert.equal(inferCountryFromPostalCode(""), "BE");
  assert.equal(inferCountryFromPostalCode(null), "BE");
});
```

(Merge the import into the existing import block.) Run `yarn test` and expect a FAIL.

**Implement** in `apps/storefront/src/lib/auth/registration-options.ts`:

```ts
/** Dutch postcodes carry two letters (1012 AB); everything else defaults to BE. */
export function inferCountryFromPostalCode(value: string | null | undefined): string {
  const cleaned = value?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
  return /^[1-9][0-9]{3}[A-Z]{2}$/.test(cleaned) ? "NL" : REGISTRATION_DEFAULT_COUNTRY;
}
```

**Use it** in `apps/storefront/src/app/actions/auth.ts:166-167`:

```ts
  const postalCode = formData.get("postal_code")?.toString() ?? null;
  const countryCode =
    formData.get("country_code")?.toString() || inferCountryFromPostalCode(postalCode);
```

Run `yarn test` and expect a pass.

### Task 1.2: Legacy campaign params (pure, tested)

**Test first:** in `apps/storefront/src/lib/auth/account-paths.test.ts`, add:

```ts
import { resolveLegacyRegisterRedirect } from "./account-paths.ts"; // merge into existing import

test("legacy /register campaign params go to the aanbieder path", () => {
  assert.equal(resolveLegacyRegisterRedirect({}), null);
  assert.equal(resolveLegacyRegisterRedirect({ intent: "discover" }), null);
  assert.equal(resolveLegacyRegisterRedirect({ intent: "offer" }), "/register/aanbieden");
  assert.equal(
    resolveLegacyRegisterRedirect({ intent: "aanbieden", next: "/agenda" }),
    "/register/aanbieden?next=%2Fagenda"
  );
  assert.equal(resolveLegacyRegisterRedirect({ focus: "verkoper" }), "/register/merchant?next=%2Fdashboard");
  assert.equal(resolveLegacyRegisterRedirect({ focus: "organisator" }), "/register/creator?focus=organizer");
  assert.equal(resolveLegacyRegisterRedirect({ focus: "onzin" }), "/register/aanbieden");
});
```

Also update the existing expectations. Offer roles should no longer force `/dashboard/pagina`, otherwise `registerAction` skips `/onboarding` (`auth.ts:178-183`):

```ts
  assert.equal(getAccountRegistrationHref("organizer", null), "/register/creator?focus=organizer");
  assert.equal(getAccountRegistrationHref("maker", null), "/register/creator?focus=maker");
  assert.equal(getAccountRegistrationHref("creator", ""), "/register/creator");
  assert.equal(getAccountRegistrationHref("aanbieder", null), "/register/aanbieden");
```

Keep: `workshopgever` with explicit `/dashboard/pagina` (an explicit next is preserved) and `merchant` → `?next=%2Fdashboard`.

Run `yarn test` and expect a FAIL.

**Implement** in `apps/storefront/src/lib/auth/account-paths.ts`:

```ts
export type AccountRegistrationType =
  | "member"
  | "aanbieder"
  | "creator"
  | "maker"
  | "merchant"
  | "workshopgever"
  | "organizer";

const DEFAULT_DESTINATIONS: Record<AccountRegistrationType, string | null> = {
  member: null,
  aanbieder: null,
  // null: registerAction then routes offer roles through /onboarding.
  creator: null,
  maker: null,
  workshopgever: null,
  organizer: null,
  merchant: "/dashboard",
};

const REGISTRATION_PATHS: Record<AccountRegistrationType, string> = {
  member: "/register",
  aanbieder: "/register/aanbieden",
  creator: "/register/creator",
  maker: "/register/creator?focus=maker",
  merchant: "/register/merchant",
  workshopgever: "/register/creator?focus=workshopgever",
  organizer: "/register/creator?focus=organizer",
};

export type OfferRoleParam = "workshopgever" | "maker" | "organizer" | "merchant";

export function parseOfferRoleParam(value: string | null | undefined): OfferRoleParam | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  if (v === "workshopgever") return "workshopgever";
  if (v === "maker" || v === "creator") return "maker";
  if (v === "organizer" || v === "organisator") return "organizer";
  if (v === "merchant" || v === "verkoper") return "merchant";
  return null;
}

/** Old /register?intent=offer&focus=… links. Null means: show the plain form. */
export function resolveLegacyRegisterRedirect(input: {
  intent?: string;
  focus?: string;
  next?: string;
}): string | null {
  const role = parseOfferRoleParam(input.focus);
  if (role) return getAccountRegistrationHref(role, input.next);
  const intent = input.intent?.trim().toLowerCase();
  if (intent === "offer" || intent === "aanbieden" || input.focus) {
    return getAccountRegistrationHref("aanbieder", input.next);
  }
  return null;
}
```

Run `yarn test` and expect a pass.

### Task 1.3: `RegisterForm` component

**Create:** `apps/storefront/src/components/auth/RegisterForm.tsx`

```tsx
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/app/actions/auth";
import type { RegistrationOfferRole } from "@/lib/auth/registration-options";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";

type RegisterFormProps = {
  action: (prev: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  nextPath: string;
  loginHref: string;
  /** Aanbieder signups: sent as offer_roles so registerAction routes to /onboarding. */
  offerRole?: Exclude<RegistrationOfferRole, "merchant"> | null;
  submitLabel?: string;
};

const inputClass =
  "min-h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--background)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";
const labelClass = "mb-2 block text-base font-semibold text-[var(--foreground)]";
const hintClass = "mt-2 block text-sm leading-relaxed text-[var(--muted)]";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)] active:scale-[0.99] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {pending ? "Even geduld..." : label}
    </button>
  );
}

export function RegisterForm({
  action,
  nextPath,
  loginHref,
  offerRole = null,
  submitLabel = "Gratis account maken",
}: RegisterFormProps) {
  const [state, formAction] = useActionState(action, { success: false, message: "" });
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  if (state.success) {
    return (
      <div role="status" className="space-y-3">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
          Kijk in je mailbox
        </h2>
        <p className="text-lg leading-relaxed text-[var(--foreground)]">
          We stuurden een bevestigingsmail naar <strong>{email}</strong>. Klik op de
          knop in die mail om je account te activeren.
        </p>
        <p className="text-base leading-relaxed text-[var(--muted)]">
          Niets ontvangen? Kijk ook bij Spam of Ongewenst.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="next" value={nextPath} />
      {offerRole ? <input type="hidden" name="offer_roles" value={offerRole} /> : null}

      <label className="block">
        <span className={labelClass}>E-mailadres</span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>

      <div>
        <label htmlFor="register-password" className={labelClass}>
          Wachtwoord
        </label>
        <div className="flex gap-2">
          <input
            id="register-password"
            required
            type={showPassword ? "text" : "password"}
            name="password"
            minLength={8}
            autoComplete="new-password"
            aria-describedby="register-password-hint"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            className="min-h-12 shrink-0 rounded-xl border border-[var(--border-strong)] px-4 text-base font-medium text-[var(--foreground)] hover:border-[var(--accent)]"
          >
            {showPassword ? "Verberg" : "Toon"}
          </button>
        </div>
        <span id="register-password-hint" className={hintClass}>
          Minstens 8 tekens.
        </span>
      </div>

      <label className="block">
        <span className={labelClass}>
          Postcode <span className="font-normal text-[var(--muted)]">(optioneel)</span>
        </span>
        <input
          type="text"
          name="postal_code"
          maxLength={16}
          autoComplete="postal-code"
          inputMode="text"
          className={`${inputClass} max-w-[12rem]`}
        />
        <span className={hintClass}>
          Dan tonen we workshops en evenementen in je buurt.
        </span>
      </label>

      <label className="flex min-h-12 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="marketing_opt_in"
          className="mt-1 size-6 shrink-0 accent-[var(--accent)]"
        />
        <span className="text-base leading-relaxed text-[var(--foreground)]">
          Stuur mij af en toe inspiratie en nieuws. Je kunt dit altijd uitzetten.
        </span>
      </label>

      {state.message ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
        >
          {state.message}
        </p>
      ) : null}

      <TurnstileWidget onTokenChange={setCaptchaToken} />
      <input type="hidden" name="cf-turnstile-response" value={captchaToken ?? ""} />

      <SubmitButton label={submitLabel} />

      <p className="text-base text-[var(--muted)]">
        Gratis, geen abonnement. Al een account?{" "}
        <Link href={loginHref} className="font-semibold text-[var(--accent)] underline underline-offset-4">
          Meld je aan
        </Link>
        .
      </p>
    </form>
  );
}
```

There's no React component test harness in this repo (no testing-library or jsdom). Verify with `npx tsc --noEmit -p .` and on the preview (section 5).

### Task 1.4: Rewrite `/register/page.tsx`

**Modify:** `apps/storefront/src/app/(public)/register/page.tsx`. Remove the hobby-domain fetch, `parseInitialIntent` and `parseInitialOfferRole`. The new body:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { registerAction } from "@/app/actions/auth";
import { getAuthUser } from "@/lib/auth/session";
import {
  getAccountRegistrationHref,
  getSafeInternalPath,
  resolveLegacyRegisterRedirect,
} from "@/lib/auth/account-paths";
import { Container } from "@/components/ui/container";
import { CardShell } from "@/components/ui/card-shell";

export const metadata: Metadata = {
  title: "Registreren",
  description:
    "Maak gratis je Hobbysalon-account. Bewaar favorieten en vind workshops en evenementen in je buurt.",
};

type Props = {
  searchParams: Promise<{ next?: string; intent?: string; focus?: string }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const { next, intent, focus } = await searchParams;
  const nextPath = getSafeInternalPath(next, "");

  if (user) redirect(nextPath || "/");

  const legacy = resolveLegacyRegisterRedirect({ intent, focus, next: nextPath });
  if (legacy) redirect(legacy);

  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";

  return (
    <div className="bg-[var(--section-alt)]">
      <Container className="max-w-xl py-10 sm:py-12">
        <header className="mb-6">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-[-0.02em] text-[var(--foreground)] sm:text-4xl">
            Maak je gratis account
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-[var(--muted)]">
            Bewaar favorieten, schrijf je in voor workshops en vind activiteiten in je buurt.
          </p>
        </header>

        <CardShell variant="default" padding="lg" className="border-[var(--border-strong)] shadow-[var(--shadow-md)]">
          <RegisterForm action={registerAction} nextPath={nextPath} loginHref={loginHref} />
        </CardShell>

        <p className="mt-8 text-base leading-relaxed text-[var(--foreground)]">
          Wil je zelf workshops geven, creaties verkopen of een evenement organiseren?{" "}
          <Link
            href={getAccountRegistrationHref("aanbieder", nextPath)}
            className="font-semibold text-[var(--accent)] underline underline-offset-4"
          >
            Meld je aan als aanbieder
          </Link>
        </p>
      </Container>
    </div>
  );
}
```

Note: the title was `"Registreren | Hobbysalon"`, which renders as "Registreren | Hobbysalon | Hobbysalon" because `app/layout.tsx:25` already applies the `%s | Hobbysalon` template. 23 other pages have the same double suffix. Fix only this page here and list the rest as a follow-up.

### Task 1.5: `/login` links to a plain account first

**Modify:** `apps/storefront/src/app/(public)/login/page.tsx:63`. Replace `<AccountChoiceCards nextPath={nextPath} />` with:

```tsx
        <div className="mt-8 space-y-3 text-base leading-relaxed text-[var(--foreground)]">
          <p>
            Nog geen account?{" "}
            <Link href={getAccountRegistrationHref("member", nextPath)} className="font-semibold text-[var(--accent)] underline underline-offset-4">
              Maak gratis een account
            </Link>
          </p>
          <p className="text-[var(--muted)]">
            Wil je iets aanbieden?{" "}
            <Link href={getAccountRegistrationHref("aanbieder", nextPath)} className="font-semibold text-[var(--accent)] underline underline-offset-4">
              Meld je aan als aanbieder
            </Link>
          </p>
        </div>
```

Update the imports (drop `AccountChoiceCards`, add `getAccountRegistrationHref`).

### Task 1.6: Verify and commit

```bash
cd apps/storefront
yarn test && ./node_modules/.bin/vitest run && npx tsc --noEmit -p . && yarn lint && yarn build
```

Commit: `ux(register): one plain hobbyist form; aanbieder path is a single link`. Push.

Phase 1 links to `/register/aanbieden`, which only exists after Phase 2. **Do not push Phase 1 alone.** Either finish Task 2.1 first or squash 1 and 2.1 into one push (rule: never push nav to a missing page).

---

## Phase 2: One aanbieder path (about 3h)

### Task 2.1: Chooser page `/register/aanbieden`

**Modify:** `apps/storefront/src/components/auth/AccountChoiceCards.tsx`:
- Add optional props `title?: string` (default "Wil je zelf iets aanbieden?") and `lead?: string` (default the current text). Render them instead of the hardcoded strings at lines 99-104.
- Change the card titles to task labels: "Workshops geven", "Mijn creaties tonen en verkopen", "Een markt of evenement organiseren", "Mijn winkel of materialen aanbieden". Keep the descriptions and icons.
- Bump the description text from `text-sm` to `text-base`.

**Create:** `apps/storefront/src/app/(public)/register/aanbieden/page.tsx`

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { AccountChoiceCards } from "@/components/auth/AccountChoiceCards";
import { PageLayout } from "@/components/layout/page-layout";
import { getAccountRegistrationHref, getSafeInternalPath } from "@/lib/auth/account-paths";

export const metadata: Metadata = {
  title: "Aanbieden op Hobbysalon",
  description: "Geef workshops, toon je creaties, organiseer een evenement of bied je winkel aan.",
};

type Props = { searchParams: Promise<{ next?: string }> };

export default async function RegisterAanbiedenPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = getSafeInternalPath(next, "");

  return (
    <div className="bg-[var(--section-alt)]">
      <PageLayout
        title="Aanbieden op Hobbysalon"
        description="Kies wat je wil doen. Je account is gratis."
        size="narrow"
      >
        <AccountChoiceCards nextPath={nextPath} title="Wat wil je aanbieden?" lead="Je kunt later altijd iets toevoegen." />
        <p className="mt-6 text-base text-[var(--muted)]">
          Alleen ontdekken?{" "}
          <Link href={getAccountRegistrationHref("member", nextPath)} className="font-semibold text-[var(--accent)] underline underline-offset-4">
            Maak een gewoon account
          </Link>
        </p>
      </PageLayout>
    </div>
  );
}
```

`robots.ts` already disallows `/register`, so this route is covered.

### Task 2.2: `/register/creator` uses the simple form

**Modify:** `apps/storefront/src/app/(public)/register/creator/page.tsx`:
- `focus` goes through `parseOfferRoleParam`. If there's no role, redirect to `getAccountRegistrationHref("aanbieder", next)`. If the role is `merchant`, redirect to `getAccountRegistrationHref("merchant", next)`.
- `nextPath = getSafeInternalPath(next, "")` (was `/dashboard/pagina`).
- Keep the logged-in branch, but fix the empty-path case: `redirect(nextPath && !nextPath.startsWith("/profile") ? nextPath : "/onboarding")` when `hasCreatorProfile`.
- Render `<RegisterForm action={registerAction} nextPath={nextPath} loginHref=... offerRole={role} submitLabel="Account maken en verder" />` under a role heading:

```ts
const ROLE_COPY = {
  workshopgever: { title: "Workshops geven", lead: "Maak eerst je gratis account. Daarna stel je je profiel in en zet je je eerste workshop klaar." },
  maker: { title: "Je creaties tonen en verkopen", lead: "Maak eerst je gratis account. Daarna stel je je profiel in en voeg je je eerste creatie toe." },
  organizer: { title: "Een markt of evenement organiseren", lead: "Maak eerst je gratis account. Daarna stel je je profiel in en zet je je evenement in de agenda." },
} as const;
```

- Below the card: "Workshopgever en organisator worden eerst kort nagekeken door Hobbysalon." Show this only for `workshopgever`/`organizer` (approval comes from `creatorTypesRequiringApproval`).
- Remove `AccountChoiceCards` from this page.

This retires the long `CreatorRegisterForm` for new signups. `registerAction` already handles `offer_roles` (`auth.ts:172-183, 262`) and sends people to `/onboarding`, which creates the creator profile, syncs privileged roles and asks for the first listing (`actions/onboarding.ts:174-319`). The Medusa creator seller is created lazily on the first commerce action (`actions/dashboard.ts:423-437`). This is the same path that `/register?intent=offer` users already take.

### Task 2.3: Merchant page copy

**Modify:** `apps/storefront/src/app/(public)/register/merchant/page.tsx`:
- metadata title: "Je winkel aanmelden"
- PageLayout title: "Je winkel aanmelden"
- description: "Voor winkels en handelaars met hobbymaterialen. Na je aanmelding stel je je winkel en productimport in."
- Pass `title="Liever iets anders aanbieden?"` to the `AccountChoiceCards` at line 86.

Leave the form fields as they are (business data is needed for approval).

### Task 2.4: Manual test checklist

**Modify:** `docs/handmatige-test-checklist.md:146-152`. Creator signup now runs `/register/creator?focus=maker` → e-mail bevestigen → `/onboarding` (naam, stad, beschrijving, hobby) → `/dashboard/products/nieuw`. Add a row for `/register/aanbieden`.

### Task 2.5: Verify and commit

Run the same command block as in Task 1.6. Also run `search_files` for `CreatorRegisterForm` and expect it only in its own file.
Commit: `ux(register): aanbieder chooser; role signup reuses the plain form and /onboarding`. Push.

---

## Phase 3: Ask for interests after signup, on `/profile` (about 2h)

Depends on Phase 0. Without it, saving interests wipes consent.

### Task 3.1: Server action

**Modify:** `apps/storefront/src/app/actions/auth.ts`. Add:

```ts
export const INTERESTS_PROMPT_COOKIE = "hs_interests_prompt";

export async function saveDiscoveryInterestsAction(formData: FormData): Promise<void> {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/profile");

  if (formData.get("skip") !== "1") {
    const interestTypes = parseInterestTypes(formData);
    if (interestTypes.length > 0) {
      await persistUserRegistrationProfile({ userId: user.id, interestTypes });
    }
  }

  (await cookies()).set(INTERESTS_PROMPT_COOKIE, "done", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/profile");
  redirect("/profile");
}
```

Move the cookie name into `lib/profile/` if a `"use server"` file can't export a const (Next only allows async exports there). Put it in `apps/storefront/src/lib/profile/interests-prompt.ts`.

### Task 3.2: Prompt component

**Create:** `apps/storefront/src/components/profile/InterestsPrompt.tsx` (server component, plain `<form action={saveDiscoveryInterestsAction}>`):
- Heading "Wat wil je vooral ontdekken?"
- The 5 `REGISTRATION_INTEREST_OPTIONS` as large checkbox tiles (`min-h-14`, `text-base`, `name="interest_types"`).
- Primary button "Bewaar". A secondary `<button name="skip" value="1">Overslaan</button>`.

### Task 3.3: Show it on `/profile`

**Modify:** `apps/storefront/src/app/(public)/profile/page.tsx`. Above the passport strip (before line 260), render `<InterestsPrompt />` when all three hold:
- `(registrationContext.preference?.interestTypes.length ?? 0) === 0`
- `!creator`
- the cookie `hs_interests_prompt` is not set (read via `cookies()`)

### Task 3.4: Verify and commit

Same command block. Commit: `feat(profile): one-time interests prompt replaces signup interest checkboxes`. Push.

---

## Phase 4: Cleanup (about 1h)

1. Run `search_files` for `RegisterIntentForm|CreatorRegisterForm|registerCreatorAction` under `apps/storefront/src`. Delete the components with no callers, and remove `registerCreatorAction` from `actions/auth.ts`.
2. After that, check `persistCreatorRegistrationProfile` and `provisionCreatorSeller` for other callers. Delete them only if there are none.
3. `AuthForm.tsx`: the `mode="register"` branch is dead (the only caller is `login/page.tsx:48` with `mode="login"`). Drop the register branch and the `hobbyDomains` prop.
4. Run the same command block. Commit: `chore(auth): remove superseded registration forms`. Push.

---

## 5. Preview checks (Peter, on the Vercel preview)

1. `/register` at 390px wide: 4 inputs and 1 checkbox. No role or interest choices. The button is reachable within about one scroll.
2. Hobbyist signup shows the "Kijk in je mailbox" panel with the typed address and no second submit button. The mail link lands on `/profile`, which shows the interests prompt. "Bewaar" hides it and the choices persist.
3. `/register?intent=offer` → `/register/aanbieden`. `/register?focus=workshopgever` → `/register/creator?focus=workshopgever`.
4. `/voor-makers` CTA → maker form → confirm → `/onboarding` maker profile → `/dashboard/products/nieuw`. Creating a product works (lazy Medusa seller).
5. `/voor-workshopgevers` → the role form shows the approval note. After onboarding, the role request is pending in `/beheer/rollen`.
6. `/login` shows "Nog geen account? Maak gratis een account" first.
7. A logged-in hobbyist who opted into the newsletter at signup activates a winkel via `/register/merchant`. `user_preferences.marketing_opt_in` stays `true` (Phase 0).
8. Postcode `1012 AB` stores `country_code = NL`. `2800` stores `BE`.

## 6. Risks and trade-offs

- **Fewer interest signals at signup.** `recommendations.ts:153-252` uses `interest_types`. Users who skip the prompt start without them. Mitigation: the prompt, plus measuring the fill rate (count `user_preferences` with non-empty `interest_types` among new users).
- **Seller creation moves later** for new makers, from signup to the first commerce action. The intent-first flow already relies on this. Preview check 4 covers it.
- **`content_creator` / `supplier`** can no longer be chosen at signup. `/voor-contentmakers` links to `/register/creator` with no focus, which now lands on the chooser. See open question 2.
- **Dutch postcode typed without letters** falls back to BE. This only affects location defaults, and the user can change it later on `/profile#locatie`.
- **Campaign links** with `?intent`/`?focus` keep working through `resolveLegacyRegisterRedirect`.
- **Pre-existing:** 23 pages set `title: "... | Hobbysalon"` on top of the layout template (double suffix). Separate follow-up.

## 7. Decisions (Peter, 2026-10-06)

1. Interests: ask once on `/profile` after signup (Phase 3 as planned).
2. Contentmakers: use the maker path. `CONTENT_PAGE.primaryCta.href` in `lib/pricing/public-pricing.ts` becomes `/register/creator?focus=maker`; no fifth card.
