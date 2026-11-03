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
      className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--section-highlight)] p-5"
    >
      <h2
        id="uitnodigen-titel"
        className="mb-2 flex items-center gap-2 text-xl font-bold text-[var(--foreground)]"
      >
        <Gift size={22} aria-hidden="true" className="text-[var(--accent-hover)]" />
        Nodig een vriend uit
      </h2>
      <p className="text-lg text-[var(--foreground)]">
        Jullie krijgen allebei {REFERRAL_REWARD_LISTINGS} extra gratis advertenties zodra je
        vriend het e-mailadres bevestigt.
      </p>
      <p className="mt-3 text-base text-[var(--muted)]">
        Je hebt nu {freeListings} gratis advertenties.{" "}
        {rewarded > 0
          ? `${rewarded} van ${MAX_REWARDED_REFERRALS} uitnodigingen beloond.`
          : `Je kunt tot ${MAX_REWARDED_REFERRALS} vrienden uitnodigen.`}
      </p>

      {remaining > 0 ? (
        <>
          <label htmlFor="invite-url" className="mt-4 block text-base font-semibold text-[var(--foreground)]">
            Jouw link
          </label>
          <input
            id="invite-url"
            readOnly
            value={inviteUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-base text-[var(--foreground)]"
          />
          <div className="mt-4 flex flex-col gap-3">
            <Button type="button" size="lg" onClick={copy}>
              {copied ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
              {copied ? "Link gekopieerd" : "Kopieer je link"}
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Delen via WhatsApp
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a
                href={`mailto:?subject=${encodeURIComponent("Kom ook op Hobbysalon")}&body=${encodeURIComponent(message)}`}
              >
                Delen via e-mail
              </a>
            </Button>
          </div>
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
