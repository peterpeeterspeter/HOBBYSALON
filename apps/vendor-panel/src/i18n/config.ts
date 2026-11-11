import { InitOptions } from "i18next"

import translations from "./translations"

export const defaultI18nOptions: InitOptions = {
  debug: process.env.NODE_ENV === "development",
  detection: {
    caches: ["cookie", "localStorage"],
    lookupCookie: "lng",
    lookupLocalStorage: "lng",
    // Hobbysalon is Dutch-first: ignore the browser header, default to nl.
    order: ["cookie", "localStorage"],
  },
  // Dutch only: an old "lng" cookie must not switch the portal to English.
  lng: "nl",
  fallbackLng: "nl",
  interpolation: {
    escapeValue: false,
  },
  resources: translations,
  supportedLngs: Object.keys(translations),
}
