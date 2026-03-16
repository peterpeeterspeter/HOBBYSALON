"use client";

import { FotoNaarKruissteek } from "./FotoNaarKruissteek";

/**
 * Wrapper around FotoNaarKruissteek - same functionality, different SEO/entry point.
 * Plan: "Overlap met foto-naar-kruissteek; eventueel PDF-export"
 */
export function KruissteekpatroonGenerator() {
  return <FotoNaarKruissteek />;
}
