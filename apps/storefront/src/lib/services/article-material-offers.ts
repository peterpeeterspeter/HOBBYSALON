import { getMedusaProductsByIds } from "@/lib/commerce/medusa/products";
import { listArticleMaterialProducts } from "@/lib/platform/queries/article-material-products";
import {
  matchArticleMaterialOffers,
  type MaterialCommerceProduct,
  type SourceMaterialWithOffers,
} from "@/lib/content/article-material-offers";
import type { ParsedArticleMaterial } from "@/lib/content/parse-article-materials";

/** Enrich source rows only; commerce truth comes from a bounded variant batch.
 * Optional discovery failure must never erase the original author's checklist.
 */
export async function getArticleMaterialOffers(
  materials: ParsedArticleMaterial[],
): Promise<SourceMaterialWithOffers[]> {
  const withoutOffers = () => materials.map(({ key, title }) => ({ key, title, offers: [] }));
  if (!materials.length) return [];
  try {
    const candidates = await listArticleMaterialProducts(materials);
    if (!candidates.length) return withoutOffers();
    const ids = [...new Set(candidates.map(candidate => candidate.medusa_product_id!))];
    const commerce = await getMedusaProductsByIds(ids);
    if (!commerce) return withoutOffers();
    // Medusa allows nullable option containers; absence is not attribute evidence.
    const evidence = new Map<string, MaterialCommerceProduct | null>();
    for (const id of ids) {
      const product = commerce.get(id);
      evidence.set(id, product && (!product.variants || product.variants.length <= 256) ? {
        id: product.id,
        title: product.title,
        variants: product.variants?.map(variant => ({
          id: variant.id,
          title: variant.title,
          calculated_price: variant.calculated_price,
          options: variant.options?.map(option => ({ value: option.value, option: option.option ?? undefined })),
        })),
      } : null);
    }
    return matchArticleMaterialOffers(materials, candidates, evidence);
  } catch {
    return withoutOffers();
  }
}
