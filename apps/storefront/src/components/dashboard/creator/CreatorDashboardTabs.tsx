import Link from "next/link";
import { cn } from "@/lib/utils";
import { CREATOR_TABS, type CreatorTab } from "./types";

type CreatorDashboardTabsProps = {
  activeTab: CreatorTab;
  basePath?: string;
  preserveQuery?: {
    success?: string;
    error?: string;
  };
  children: React.ReactNode;
};

function buildTabHref(
  tab: CreatorTab,
  basePath: string,
  preserveQuery?: CreatorDashboardTabsProps["preserveQuery"]
) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (preserveQuery?.success) {
    params.set("success", preserveQuery.success);
  }
  if (preserveQuery?.error) {
    params.set("error", preserveQuery.error);
  }
  return `${basePath}?${params.toString()}#maker-pagina`;
}

export function CreatorDashboardTabs({
  activeTab,
  basePath = "/profile",
  preserveQuery,
  children,
}: CreatorDashboardTabsProps) {
  return (
    <div className="space-y-6">
      <nav
        aria-label="Creator dashboard secties"
        className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-1"
      >
        {CREATOR_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={buildTabHref(tab.id, basePath, preserveQuery)}
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
