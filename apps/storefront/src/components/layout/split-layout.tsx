import { cn } from "@/lib/utils";

type SplitLayoutProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** Sidebar position */
  sidebarPosition?: "left" | "right";
  className?: string;
};

function SplitLayout({
  sidebar,
  children,
  sidebarPosition = "left",
  className,
}: SplitLayoutProps) {
  return (
    <div
      className={cn(
        "grid gap-8 lg:grid-cols-[280px_1fr]",
        sidebarPosition === "right" && "lg:grid-cols-[1fr_280px]",
        className
      )}
    >
      {sidebarPosition === "left" ? (
        <>
          <aside className="space-y-6">{sidebar}</aside>
          <main className="min-w-0">{children}</main>
        </>
      ) : (
        <>
          <main className="min-w-0">{children}</main>
          <aside className="space-y-6">{sidebar}</aside>
        </>
      )}
    </div>
  );
}

export { SplitLayout };
export type { SplitLayoutProps };
