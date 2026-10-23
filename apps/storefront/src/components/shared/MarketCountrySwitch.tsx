"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { MarketCode } from "@/lib/markets/config";
import { marketSwitchTargets } from "@/lib/markets/urls";

type MarketCountrySwitchProps = {
  currentCode: MarketCode;
};

function MarketCountrySwitchLinks({ currentCode }: MarketCountrySwitchProps) {
  const pathname = usePathname() || "/";
  const params = useSearchParams();
  const query = params.toString();
  const currentPath = query ? `${pathname}?${query}` : pathname;
  const targets = marketSwitchTargets({ currentPath, currentMarket: currentCode });
  if (targets.length === 0) return null;

  const hostBound = targets.some((target) => target.hostBound);

  return (
    <div className="flex flex-col items-end gap-1">
      <nav aria-label="Kies land" className="flex items-center gap-1">
        {targets.map((target) => (
          <a
            key={target.code}
            href={target.href}
            aria-current={target.current ? "true" : undefined}
            className={
              target.current
                ? "inline-flex min-h-11 items-center rounded-md bg-[var(--background)] px-3 text-[15px] font-semibold text-[var(--foreground)]"
                : "inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            }
          >
            {target.label}
          </a>
        ))}
      </nav>
      {hostBound ? (
        <p className="max-w-48 text-right text-xs leading-snug text-[var(--muted)]">
          Winkelwagen en betalen blijven op deze site.
        </p>
      ) : null}
    </div>
  );
}

export function MarketCountrySwitch({ currentCode }: MarketCountrySwitchProps) {
  return (
    <Suspense fallback={null}>
      <MarketCountrySwitchLinks currentCode={currentCode} />
    </Suspense>
  );
}
