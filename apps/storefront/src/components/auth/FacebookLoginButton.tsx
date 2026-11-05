import { facebookLoginAction } from "@/app/actions/auth";
import { isFacebookLoginEnabled } from "@/lib/auth/session";

type Props = {
  nextPath?: string;
  label?: string;
};

/** Large, clear Facebook button. Hidden until FACEBOOK_LOGIN_ENABLED=true. */
export function FacebookLoginButton({
  nextPath,
  label = "Doorgaan met Facebook",
}: Props) {
  if (!isFacebookLoginEnabled()) return null;

  return (
    <form action={facebookLoginAction}>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <button
        type="submit"
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-5 py-3 text-lg font-semibold text-white hover:bg-[#166FE5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
        </svg>
        {label}
      </button>
      <p className="mt-2 text-sm text-[var(--muted)]">
        We gebruiken alleen je naam en e-mailadres.
      </p>
      <div className="my-6 flex items-center gap-3 text-base text-[var(--muted)]" aria-hidden="true">
        <span className="h-px flex-1 bg-[var(--border)]" />
        of met je e-mailadres
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
    </form>
  );
}
