import { listActiveDomains } from "@/lib/platform/queries/domains";
import { listFeaturedCreators } from "@/lib/platform/queries/creators";
import { listFeaturedProducts } from "@/lib/platform/queries/products";
import { listUpcomingWorkshops } from "@/lib/platform/queries/workshops";
import { listEvents } from "@/lib/platform/queries/events";
import { listLatestArticles } from "@/lib/platform/queries/articles";
import { getMedusaProduct } from "@/lib/commerce/medusa/products";
import type {
  Domain,
  Creator,
  Workshop,
  Event,
  Article,
  Product,
} from "@/types/platform";

type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

export type HomePageData = {
  popularDomains: Domain[];
  upcomingWorkshops: Workshop[];
  featuredHandmade: ProductWithPrice[];
  featuredSupplies: ProductWithPrice[];
  upcomingEvents: Event[];
  latestArticles: Article[];
  creatorsOfTheMonth: Creator[];
};

async function enrichProductsWithPrices(
  products: Product[]
): Promise<ProductWithPrice[]> {
  const enriched = await Promise.all(
    products.map(async (product) => {
      const medusa = await getMedusaProduct(product.medusa_product_id);
      const price = medusa?.calculated_price
        ? {
            amount: medusa.calculated_price.calculated_amount,
            currency_code: medusa.calculated_price.currency_code,
          }
        : null;

      return { ...product, price };
    })
  );

  return enriched;
}

export async function getHomePageData(): Promise<HomePageData> {
  const fromDate = new Date().toISOString();

  const [
    popularDomains,
    upcomingWorkshops,
    featuredHandmade,
    featuredSupplies,
    upcomingEvents,
    latestArticles,
    creatorsOfTheMonth,
  ] = await Promise.all([
    listActiveDomains(),
    listUpcomingWorkshops(6),
    listFeaturedProducts({ productType: "handmade", limit: 8 }),
    listFeaturedProducts({ productType: "supply", limit: 8 }),
    listEvents({ from_date: fromDate, limit: 6 }),
    listLatestArticles(6),
    listFeaturedCreators(6),
  ]);

  const [handmadeWithPrices, suppliesWithPrices] = await Promise.all([
    enrichProductsWithPrices(featuredHandmade),
    enrichProductsWithPrices(featuredSupplies),
  ]);

  return {
    popularDomains: popularDomains.slice(0, 8),
    upcomingWorkshops,
    featuredHandmade: handmadeWithPrices,
    featuredSupplies: suppliesWithPrices,
    upcomingEvents,
    latestArticles,
    creatorsOfTheMonth,
  };
}
