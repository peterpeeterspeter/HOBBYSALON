"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { CREATOR_TABS, type CreatorTab } from "./types";

type CreatorDashboardTabsProps = {
  activeTab: CreatorTab;
  children: React.ReactNode;
};

export function CreatorDashboardTabs({ activeTab, children }: CreatorDashboardTabsProps) {
  const searchParams = useSearchParams();

  function buildTabHref(tab: CreatorTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    const query = params.toString();
    return query ? `/dashboard/creator?${query}` : `/dashboard/creator?tab=${tab}`;
  }

  return (
    <div className="space-y-6">
      <nav
        aria-label="Creator dashboard secties"
        className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-1"
      >
        {CREATOR_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={buildTabHref(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={cn(
              "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

export function resolveCreatorTab(tab: string | undefined): CreatorTab {
  const value = tab ?? null;
  if (value === "profiel" || value === "artikels" || value === "portfolio") {
    return value;
  }
  return "profiel";
}
