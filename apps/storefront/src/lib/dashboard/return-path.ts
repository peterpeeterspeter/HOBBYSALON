/**
 * Where to send the user after a dashboard action. Forms may post a
 * `return_to` path (e.g. the edit page they are on). Only `fallback` itself
 * or one or two plain path segments below it are accepted, so this can never
 * become an open redirect or jump to another dashboard section.
 */
export function resolveReturnPath(formData: FormData, fallback: string): string {
  const raw = formData.get("return_to")?.toString() ?? "";
  if (!raw || !raw.startsWith(fallback)) {
    return fallback;
  }
  const rest = raw.slice(fallback.length);
  if (rest === "") {
    return fallback;
  }
  if (!/^\/[a-z0-9-]+(\/[a-z0-9-]+)?$/i.test(rest)) {
    return fallback;
  }
  return raw;
}

const OFFER_FILTER: Record<string, string> = {
  "/dashboard/workshops": "workshops",
  "/dashboard/events": "events",
  "/dashboard/products": "creaties",
};

/**
 * After creating an item from its "nieuw" page, open the new item's edit
 * page instead of showing an empty form again.
 */
export function successPathAfterCreate(
  returnPath: string,
  base: string,
  createdId: string | null | undefined
): string {
  if (createdId && returnPath === `${base}/nieuw`) {
    return `${base}/${createdId}`;
  }
  return returnPath;
}

/**
 * After deleting an item from its own edit page, that page no longer exists:
 * go back to the offer overview, filtered on the same kind.
 */
export function successPathAfterDelete(returnPath: string, base: string): string {
  if (returnPath === base) {
    return base;
  }
  const filter = OFFER_FILTER[base];
  return filter ? `/dashboard/aanbod?soort=${filter}` : "/dashboard/aanbod";
}

/** Append a flash message to a path that may already carry a query string or hash. */
export function withFlash(path: string, kind: "success" | "error", message: string): string {
  const hashIndex = path.indexOf("#");
  const base = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${kind}=${encodeURIComponent(message)}${hash}`;
}
