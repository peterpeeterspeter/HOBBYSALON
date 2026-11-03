"use client";

import { Facebook, Gift, Instagram, Youtube } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { SOCIAL_CHANNELS, SOCIAL_CONTEST_RULES_HREF, type SocialChannel } from "@/config/social";

function PinterestIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
    </svg>
  );
}

function TiktokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.77.12V9.79a5.7 5.7 0 1 0 4.91 5.64V9.01a7.34 7.34 0 0 0 4.29 1.37V7.29a4.29 4.29 0 0 1-3.23-1.47z" />
    </svg>
  );
}

const ICONS: Record<SocialChannel["id"], ComponentType<{ size?: number; className?: string }>> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  pinterest: ({ size = 28, className }) => <PinterestIcon width={size} height={size} className={className} />,
  tiktok: ({ size = 28, className }) => <TiktokIcon width={size} height={size} className={className} />,
};

/**
 * Homepage banner: follow Hobbysalon on social media and win a voucher.
 * Each tile opens the profile (the app on a phone), where one tap follows.
 */
export function SocialFollowBanner({ placement = "home" }: { placement?: string }) {
  if (SOCIAL_CHANNELS.length === 0) return null;
  return (
    <section
      aria-labelledby="social-banner-titel"
      className="overflow-hidden rounded-3xl bg-[var(--foreground)] text-white"
    >
      <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-base font-semibold text-white">
            <Gift size={18} aria-hidden className="text-[var(--accent)]" />
            Actie
          </p>
          <h2
            id="social-banner-titel"
            className="mt-4 max-w-[22ch] font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight tracking-[-0.02em] [text-wrap:balance] md:text-4xl"
          >
            Volg ons en win een waardebon van €100
          </h2>
          <p className="mt-3 max-w-[52ch] text-lg leading-relaxed text-white/85 [text-wrap:pretty]">
            Per kanaal waarop je Hobbysalon volgt, maak je kans op een Hobbysalon waardebon van €100.
            Hoe meer kanalen, hoe meer kansen.
          </p>
          <p className="mt-4 text-base text-white/70">
            {SOCIAL_CONTEST_RULES_HREF ? (
              <a href={SOCIAL_CONTEST_RULES_HREF} className="font-semibold text-white underline underline-offset-4 hover:no-underline">
                Bekijk de actievoorwaarden
              </a>
            ) : (
              "De actievoorwaarden volgen binnenkort."
            )}
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {SOCIAL_CHANNELS.map((channel) => {
            const Icon = ICONS[channel.id];
            return (
              <li key={channel.id}>
                <a
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${channel.action} Hobbysalon op ${channel.label} (opent in een nieuw venster)`}
                  onClick={() => trackEvent("social_follow_clicked", { channel: channel.id, placement })}
                  className="group flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-[var(--foreground)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--foreground)] active:scale-[0.98] motion-reduce:transform-none xl:w-32"
                >
                  <span
                    className="flex size-12 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: channel.color }}
                  >
                    <Icon size={26} />
                  </span>
                  <span className="text-base font-semibold">{channel.label}</span>
                  <span className="text-sm text-[var(--muted)]">{channel.action}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
