import "server-only";

import { redirect } from "next/navigation";

export function requireDashboardCapability(
  allowed: boolean,
  fallbackPath = "/dashboard"
): void {
  if (!allowed) {
    redirect(fallbackPath);
  }
}
