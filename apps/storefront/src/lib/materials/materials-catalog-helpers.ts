/**
 * Materials catalog helpers: offer resolver (badge ≠ CTA) and chip set logic.
 */

import { sanitizeAgendaSearchQuery } from "@/lib/agenda/agenda-helpers";

export { sanitizeAgendaSearchQuery };

export type MaterialsOfferBadge =
  | "Webshop"
  | "Maker"
  | "Tweedehands"
  | "Workshoppakket";

export type MaterialsInteractionMode =
  | "checkout"
  | "inquire_maker"
  | "view_listing"
  | "view_kit";

export type MaterialsOffer = {
  badge: MaterialsOfferBadge;
  interactionMode: MaterialsInteractionMode;
  ctaLabel: string;
  /** Visitor-facing aanbieder filter key */
  offerKey: "webshop" | "maker" | "destash" | "kit";
};

export type MaterialsOfferInput = {
  product_type: string;
  medusa_product_id?: string | null;
};

function hasMedusaLink(product: MaterialsOfferInput): boolean {
  return Boolean(product.medusa_product_id?.trim());
}

/**
 * Badge and interaction mode are independent so legacy maker products
 * with a Medusa link keep checkout while still showing Maker/Tweedehands.
 */
export function resolveMaterialsOffer(
  product: MaterialsOfferInput
): MaterialsOffer {
  const type = (product.product_type ?? "").toLowerCase();
  const linked = hasMedusaLink(product);

  if (type === "workshop_kit") {
    return {
      badge: "Workshoppakket",
      interactionMode: "view_kit",
      ctaLabel: "Bekijk pakket",
      offerKey: "kit",
    };
  }

  if (type === "destash") {
    return {
      badge: "Tweedehands",
      interactionMode: linked ? "checkout" : "view_listing",
      ctaLabel: linked ? "Bekijk product" : "Bekijk advertentie",
      offerKey: "destash",
    };
  }

  if (type === "handmade") {
    return {
      badge: "Maker",
      interactionMode: linked ? "checkout" : "inquire_maker",
      ctaLabel: linked ? "Bekijk product" : "Vraag de maker",
      offerKey: "maker",
    };
  }

  // supply / supplies / default commerce materials
  return {
    badge: "Webshop",
    interactionMode: linked ? "checkout" : "view_listing",
    ctaLabel: linked ? "Bekijk product" : "Bekijk product",
    offerKey: "webshop",
  };
}

/** Product types included in the materials catalog (no digital patterns). */
export const MATERIALS_CATALOG_PRODUCT_TYPES = [
  "supply",
  "supplies",
  "handmade",
  "destash",
  "workshop_kit",
] as const;

export function productMatchesOfferFilter(
  product: MaterialsOfferInput,
  offer: string | null | undefined
): boolean {
  if (!offer) return true;
  return resolveMaterialsOffer(product).offerKey === offer;
}

/** Categories with supply + always keep selected. */
export function resolveCategoryChipIds(options: {
  categoryIdsWithSupply: string[];
  selectedCategoryId?: string | null;
  allCategoryIdsOrdered: string[];
}): string[] {
  const present = new Set(options.categoryIdsWithSupply.filter(Boolean));
  if (options.selectedCategoryId) {
    present.add(options.selectedCategoryId);
  }
  return options.allCategoryIdsOrdered.filter((id) => present.has(id));
}

export const MATERIALS_SHORTCUTS: Array<{
  label: string;
  /** Match against category name (case-insensitive substring). */
  nameIncludes: string[];
}> = [
  { label: "Garen & wol", nameIncludes: ["garen", "wol"] },
  { label: "Klei & keramiek", nameIncludes: ["klei", "keramiek", "boetseer"] },
  { label: "Verf & tekenen", nameIncludes: ["verf", "teken", "schilder"] },
  { label: "Papier & kaarten", nameIncludes: ["papier", "kaart"] },
  { label: "Stoffen & naaien", nameIncludes: ["stof", "naai"] },
];
