// Fail-closed route allowlist. Never use document.title or arbitrary URL text.
const STATIC_PAGES: Readonly<Record<string, string>> = {
  "/": "Home", "/landing": "Welkom", "/workshops": "Workshops", "/agenda": "Agenda",
  "/creators": "Makers", "/artikelen": "Artikelen", "/patronen": "Patronen",
  "/gratis-haakpatronen": "Gratis haakpatronen", "/materials": "Materialen",
  "/tools": "Tools", "/zoeken": "Zoeken", "/cart": "Winkelwagen", "/checkout": "Afrekenen",
  "/checkout/success": "Bestelling ontvangen", "/nieuwsbrief": "Nieuwsbrief", "/enquete": "Enquête",
  "/over-ons": "Over ons", "/partners": "Partners", "/prijzen": "Prijzen", "/privacy": "Privacy",
  "/adverteren": "Adverteren", "/voor-hobbyisten": "Voor hobbyisten", "/voor-makers": "Voor makers",
  "/voor-workshopgevers": "Voor workshopgevers", "/voor-winkels": "Voor winkels",
  "/voor-contentmakers": "Voor contentmakers", "/voor-organisatoren": "Voor organisatoren",
};
const DETAIL_PAGES: Readonly<Record<string, string>> = {
  workshop: "Workshop", event: "Evenement", agenda: "Evenement", creator: "Maker",
  artikel: "Artikel", project: "Project", product: "Product", tools: "Tool", nieuwsbrief: "Nieuwsbrief",
};
const DOMAINS = new Set(["crochet", "knitting", "card-making", "sewing", "jewelry", "scrapbooking", "painting", "pottery", "diy"]);
const DOMAIN_SECTIONS = new Set(["workshops", "artikels", "learning-paths", "supplies", "handmade"]);

export type PublicPage = { path: string; title: string };
export function publicPage(rawPath: string): PublicPage | null {
  const path = rawPath.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  if (Object.hasOwn(STATIC_PAGES, path)) return { path, title: `${STATIC_PAGES[path]} | Hobbysalon` };
  const parts = path.split("/").slice(1);
  if (parts.length === 2 && Object.hasOwn(DETAIL_PAGES, parts[0]) && /^[a-z0-9][a-z0-9-]{0,159}$/.test(parts[1])) {
    // Dynamic slugs can contain names. Record the route template, never the slug.
    return { path: `/${parts[0]}/detail`, title: `${DETAIL_PAGES[parts[0]]} | Hobbysalon` };
  }
  if (DOMAINS.has(parts[0]) && (parts.length === 1 || (parts.length === 2 && DOMAIN_SECTIONS.has(parts[1])))) {
    return { path, title: "Hobbydomein | Hobbysalon" };
  }
  if (DOMAINS.has(parts[0]) && parts.length === 3 && parts[1] === "learning-paths" && /^[a-z0-9-]{1,160}$/.test(parts[2])) {
    return { path: `/${parts[0]}/learning-paths/detail`, title: "Leerpad | Hobbysalon" };
  }
  return null;
}

export function pageParameters(rawUrl: string, rawReferrer = ""): Record<string, string> | null {
  try {
    const url = new URL(rawUrl);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const page = publicPage(url.pathname);
    if (!page) return null;
    // Blank referrer explicitly overrides Google's default (which can contain tokens).
    let referrer = "";
    try {
      const ref = new URL(rawReferrer);
      if (["https:", "http:"].includes(ref.protocol)) {
        const ownPage = ref.origin === url.origin ? publicPage(ref.pathname) : null;
        referrer = ownPage ? `${ref.origin}${ownPage.path}` : ref.origin;
      }
    } catch { /* No raw referrers. */ }
    return { page_location: `${url.origin}${page.path}`, page_title: page.title, page_referrer: referrer };
  } catch { return null; }
}
