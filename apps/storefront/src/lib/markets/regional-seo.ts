import type { Metadata } from "next";
import {
  HOME_BE_HERO_INTRO,
  HOME_BE_HERO_TITLE,
  HOME_NL_HERO_INTRO,
  HOME_NL_HERO_TITLE,
} from "./discovery-preference";
import { MARKETS, type MarketCode } from "./config";
import {
  absoluteUrl,
  buildPageMetadata,
  type BuildPageMetadataInput,
} from "../seo";
import type { MarketSeoDecision } from "./seo-policy";

/** Shared landings that exist on both hosts and may carry reciprocal hreflang. */
export const REGIONAL_LANDING_PATHS = [
  "/",
  "/workshops",
  "/creators",
  "/materials",
  "/agenda",
] as const;

export type RegionalLandingPath = (typeof REGIONAL_LANDING_PATHS)[number];

export function isRegionalLandingPath(
  path: string
): path is RegionalLandingPath {
  return (REGIONAL_LANDING_PATHS as readonly string[]).includes(path);
}

type LandingCopy = { title: string; description: string };

const LANDING_COPY: Record<
  RegionalLandingPath,
  Record<MarketCode, LandingCopy>
> = {
  "/": {
    BE: {
      title: HOME_BE_HERO_TITLE,
      description: HOME_BE_HERO_INTRO,
    },
    NL: {
      title: HOME_NL_HERO_TITLE,
      description: HOME_NL_HERO_INTRO,
    },
  },
  "/workshops": {
    BE: {
      title: "Workshops | Hobbysalon",
      description: "Vind een workshop die bij je past — dichtbij of online",
    },
    NL: {
      title: "Workshops in Nederland | Hobbysalon",
      description:
        "Ontdek creatieve workshops in Nederland — Belgisch aanbod blijft ook vindbaar",
    },
  },
  "/creators": {
    BE: {
      title: "Makersmarkt | Hobbysalon",
      description:
        "Koop handgemaakte creaties en restanten rechtstreeks van makers op Hobbysalon",
    },
    NL: {
      title: "Makersmarkt in Nederland | Hobbysalon",
      description:
        "Koop handgemaakte creaties van makers in Nederland — Belgische makers blijven vindbaar",
    },
  },
  "/materials": {
    BE: {
      title: "Hobbymaterialen | Hobbysalon",
      description:
        "Vind de juiste materialen voor je project: garen, klei, verf en meer",
    },
    NL: {
      title: "Hobbymaterialen in Nederland | Hobbysalon",
      description:
        "Vind materialen voor je project in Nederland — gedeelde catalogus met België",
    },
  },
  "/agenda": {
    BE: {
      title: "Agenda | Hobbysalon",
      description:
        "Handmade markten, hobbybeurzen, pop-ups en workshops bij jou in de buurt",
    },
    NL: {
      title: "Agenda in Nederland | Hobbysalon",
      description:
        "Handmade markten, hobbybeurzen en workshops in Nederland — Belgische events blijven vindbaar",
    },
  },
};

export function regionalLandingCopy(
  path: RegionalLandingPath,
  marketCode: MarketCode
): LandingCopy {
  return LANDING_COPY[path][marketCode];
}

/** Absolute hreflang targets for a regional landing (both directions). */
export function regionalHreflangLanguages(
  path: RegionalLandingPath
): Record<string, string> {
  const be = absoluteUrl(path, MARKETS.BE.canonicalOrigin);
  const nl = absoluteUrl(path, MARKETS.NL.canonicalOrigin);
  return {
    "nl-BE": be,
    "nl-NL": nl,
    "x-default": be,
  };
}

export function buildRegionalPageMetadata(input: {
  path: RegionalLandingPath;
  decision: MarketSeoDecision;
  image?: string | null;
}): Metadata {
  const copy = regionalLandingCopy(input.path, input.decision.marketCode);
  const base: BuildPageMetadataInput = {
    title: copy.title,
    description: copy.description,
    path: input.path,
    image: input.image,
    origin: input.decision.canonicalOrigin,
    locale: input.decision.ogLocale,
    absoluteTitle: true,
    robots: {
      index: input.decision.index,
      follow: input.decision.follow,
    },
  };

  if (input.decision.publishHreflang) {
    base.languages = regionalHreflangLanguages(input.path);
  }

  return buildPageMetadata(base);
}
