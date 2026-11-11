"use client";

import { useState } from "react";
import { Gift, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MAX_REWARDED_REFERRALS,
  REFERRAL_REWARD_LISTINGS,
} from "@/lib/referrals/referral-rules";

type Props = {
  inviteUrl: string;
  rewarded: number;
  remaining: number;
  freeListings: number;
};

/** Dashboard card: invite a friend, both get 3 extra free listings. */
export function ReferralCard({ inviteUrl, rewarded, remaining, freeListings }: Props) {
  const [copied, setCopied] = useState(false);
  const message = `Ik verkoop mijn handgemaakte werk op Hobbysalon. Maak ook een account via mijn link, dan krijgen we allebei ${REFERRAL_REWARD_LISTINGS} extra gratis advertenties: ${inviteUrl}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      aria-labelledby="uitnodigen-titel"
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
    >
      <h2
        id="uitnodigen-titel"
        className="flex items-center gap-2 text-xl font-bold text-[var(--foreground)]"
      >
        <Gift size={22} aria-hidden="true" className="text-[var(--accent-hover)]" />
        Nodig een vriend uit
      </h2>
      <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
        Jullie krijgen allebei {REFERRAL_REWARD_LISTINGS} extra gratis advertenties zodra je vriend het
        e-mailadres bevestigt. Je hebt nu {freeListings} gratis advertenties.
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-base">
          <span className="font-semibold text-[var(--foreground)]">Beloonde vrienden</span>
          <span className="tabular-nums text-[var(--muted)]">
            {rewarded} van {MAX_REWARDED_REFERRALS}
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--section-alt)]"
          role="progressbar"
          aria-valuenow={rewarded}
          aria-valuemin={0}
          aria-valuemax={MAX_REWARDED_REFERRALS}
          aria-label={`${rewarded} van ${MAX_REWARDED_REFERRALS} vrienden beloond`}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${(rewarded / MAX_REWARDED_REFERRALS) * 100}%` }}
          />
        </div>
      </div>

      {remaining > 0 ? (
        <>
          <label htmlFor="invite-url" className="mt-5 block text-base font-semibold text-[var(--foreground)]">
            Jouw link
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="invite-url"
              readOnly
              value={inviteUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-base text-[var(--foreground)]"
            />
            <Button type="button" size="lg" onClick={copy} aria-label={copied ? "Link gekopieerd" : "Kopieer je link"}>
              {copied ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
              <span className="hidden sm:inline">{copied ? "Gekopieerd" : "Kopieer"}</span>
            </Button>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-base">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-[var(--accent-hover)] underline-offset-4 hover:underline"
            >
              Delen via WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent("Kom ook op Hobbysalon")}&body=${encodeURIComponent(message)}`}
              className="inline-flex min-h-11 items-center font-semibold text-[var(--accent-hover)] underline-offset-4 hover:underline"
            >
              Delen via e-mail
            </a>
          </p>
          <p role="status" className="sr-only">
            {copied ? "Link gekopieerd" : ""}
          </p>
        </>
      ) : (
        <p className="mt-4 text-base font-semibold text-[var(--foreground)]">
          Je hebt het maximum van {MAX_REWARDED_REFERRALS} beloonde uitnodigingen bereikt. Bedankt.
        </p>
      )}
    </section>
  );
}
