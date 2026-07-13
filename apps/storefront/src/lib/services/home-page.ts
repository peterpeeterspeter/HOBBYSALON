import { unstable_cache } from "next/cache";
import { listActiveDomains } from "@/lib/platform/queries/domains";
import {
  listFeaturedCreators,
  enrichCreatorsWithStats,
  type CreatorWithStats,
} from "@/lib/platform/queries/creators";
import { listFeaturedProducts } from "@/lib/platform/queries/products";
import { listUpcomingWorkshops } from "@/lib/platform/queries/workshops";
import { listEvents } from "@/lib/platform/queries/events";
import { listLatestArticles } from "@/lib/platform/queries/articles";
import { listFeaturedProjects } from "@/lib/platform/queries/projects";
import {
  getProjectRecommendations,
  type RecommendedProject,
  type RecommendationSource,
} from "@/lib/platform/queries/recommendations";
import { getMedusaProductsByIds } from "@/lib/commerce/medusa/products";
import { logServerPerf, timeAsync } from "@/lib/perf/server-timing";
import { withTimeout } from "@/lib/perf/with-timeout";
import {
  createDiscoveryFeed,
  type DiscoveryFeedItem,
} from "@/lib/services/discovery-feed";
import type {
  Domain,
  Workshop,
  Event,
  Article,
  Product,
  Project,
} from "@/types/platform";

const HOME_PAGE_FETCH_TIMEOUT_MS = 45_000;
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

export type HomeDiscoveryFeedItem = DiscoveryFeedItem<
  Article,
  ProductWithPrice,
  Workshop,
  Event
>;

export type HomePageData = {
  popularDomains: Domain[];
  upcomingWorkshops: Workshop[];
  featuredHandmade: ProductWithPrice[];
  featuredSupplies: ProductWithPrice[];
  upcomingEvents: Event[];
  latestArticles: Article[];
  discoveryFeed: HomeDiscoveryFeedItem[];
  creatorsOfTheMonth: CreatorWithStats[];
  featuredProjects: Project[];
  recommendedProjects: RecommendedProject[];
  recommendationSource: RecommendationSource;
  recommendationLatencyMs: number;
  viewerUserId: string | null;
};

const EMPTY_HOME_PAGE_DATA: HomePageData = {
  popularDomains: [],
  upcomingWorkshops: [],
  featuredHandmade: [],
  featuredSupplies: [],
  upcomingEvents: [],
  latestArticles: [],
  discoveryFeed: [],
  creatorsOfTheMonth: [],
  featuredProjects: [],
  recommendedProjects: [],
  recommendationSource: "cold_start",
  recommendationLatencyMs: 0,
  viewerUserId: null,
};

async function enrichProductsWithPrices(
  products: Product[]
): Promise<ProductWithPrice[]> {
  if (isProductionBuild) {
    return products.map((product) => ({ ...product, price: null }));
  }

  const medusaMap = await getMedusaProductsByIds(
    products.map((product) => product.medusa_product_id)
  );

  return products.map((product) => {
    const medusa = product.medusa_product_id
      ? medusaMap.get(product.medusa_product_id) ?? null
      : null;
    const price = medusa?.calculated_price
      ? {
          amount: medusa.calculated_price.calculated_amount,
          currency_code: medusa.calculated_price.currency_code,
        }
      : null;

    return { ...product, price };
  });
}

async function loadHomePageData(): Promise<HomePageData> {
  const totalStartMs = Date.now();
  const fromDate = new Date().toISOString();

  const {
    result: [
      popularDomains,
      upcomingWorkshops,
      featuredHandmade,
      featuredSupplies,
      upcomingEvents,
      latestArticles,
      creatorsOfTheMonth,
      featuredProjects,
      recommendationResult,
    ],
    durationMs: baseQueriesMs,
  } = await timeAsync(() =>
    Promise.all([
      listActiveDomains(),
      listUpcomingWorkshops(6),
      listFeaturedProducts({ productType: "handmade", limit: 8 }),
      listFeaturedProducts({ productType: "supply", limit: 8 }),
      listEvents({
        from_date: fromDate,
        limit: 6,
      }),
      listLatestArticles(6),
      listFeaturedCreators(6),
      listFeaturedProjects(4),
      withTimeout(
        getProjectRecommendations({ userId: null, limit: 6 }),
        15_000,
        {
          source: "cold_start" as const,
          projects: [],
          signalCount: 0,
          latencyMs: 0,
        }
      ),
    ])
  );

  const {
    result: [handmadeWithPrices, suppliesWithPrices, creatorsWithStats],
    durationMs: pricingMs,
  } = await timeAsync(() =>
    Promise.all([
      enrichProductsWithPrices(featuredHandmade),
      enrichProductsWithPrices(featuredSupplies),
      enrichCreatorsWithStats(creatorsOfTheMonth),
    ])
  );

  logServerPerf("home-page", {
    total: Date.now() - totalStartMs,
    base_queries: baseQueriesMs,
    pricing: pricingMs,
    recommendations: recommendationResult.latencyMs,
  });

  return {
    popularDomains: popularDomains.slice(0, 8),
    upcomingWorkshops,
    featuredHandmade: handmadeWithPrices,
    featuredSupplies: suppliesWithPrices,
    upcomingEvents,
    latestArticles,
    discoveryFeed: createDiscoveryFeed(
      {
        articles: latestArticles,
        supplies: suppliesWithPrices,
        workshops: upcomingWorkshops,
        events: upcomingEvents,
      },
      8,
    ),
    creatorsOfTheMonth: creatorsWithStats,
    featuredProjects,
    recommendedProjects: recommendationResult.projects,
    recommendationSource: recommendationResult.source,
    recommendationLatencyMs: recommendationResult.latencyMs,
    viewerUserId: null,
  };
}

const getHomePageDataCached = unstable_cache(
  async (): Promise<HomePageData> => {
    try {
      return await withTimeout(
        loadHomePageData(),
        HOME_PAGE_FETCH_TIMEOUT_MS,
        EMPTY_HOME_PAGE_DATA
      );
    } catch {
      return EMPTY_HOME_PAGE_DATA;
    }
  },
  ["home-page-data-v2"],
  {
    revalidate: 60 * 5,
    tags: ["home-page"],
  }
);

export async function getHomePageData(): Promise<HomePageData> {
  return getHomePageDataCached();
}
