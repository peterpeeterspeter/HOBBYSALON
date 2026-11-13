/** Only these routes have genuine regional publication in the current source. */
export const REGIONAL_LANDING_PATHS = [
  "/",
  "/workshops",
  "/creators",
  "/materials",
  "/agenda",
] as const;
export type RegionalLandingPath = (typeof REGIONAL_LANDING_PATHS)[number];

export function isRegionalLandingPath(path: string): path is RegionalLandingPath {
  return (REGIONAL_LANDING_PATHS as readonly string[]).includes(path);
}

/** Private route families, not public entity profiles (/creator, /project). */
export const PRIVATE_PATH_PREFIXES = [
  "/api", "/account", "/auth", "/cart", "/checkout", "/dashboard",
  "/beheer", "/favorites", "/login", "/profile", "/register",
  "/onboarding", "/wachtwoord-vergeten",
] as const;

export function isPrivatePath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
