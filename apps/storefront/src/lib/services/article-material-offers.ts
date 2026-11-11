import { getMedusaProductsByIds } from "@/lib/commerce/medusa/products";
import { listArticleMaterialProducts } from "@/lib/platform/queries/article-material-products";
import {
  matchArticleMaterialOffers,
  materialCatalogSearchTerms,
  type MaterialCommerceProduct,
  type SourceMaterialWithOffers,
} from "@/lib/content/article-material-offers";
import { matchArticleMaterialBrowseOffers } from "@/lib/content/article-material-browse";
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
    const strict = matchArticleMaterialOffers(materials, candidates, evidence);
    const browse = matchArticleMaterialBrowseOffers(materials, candidates, evidence);
    return materials.map((material, index) => {
      const exact = strict[index]?.offers ?? [];
      if (exact.length) return { key: material.key, title: material.title, offers: exact };
      // Browse only for lines the strict grammar cannot parse (e.g. "of", fiberfill).
      // Parseable lines with no exact shop match must stay empty, not loosely filled.
      if (materialCatalogSearchTerms([material]).length > 0) {
        return { key: material.key, title: material.title, offers: [] };
      }
      return { key: material.key, title: material.title, offers: browse[index]?.offers ?? [] };
    });
  } catch {
    return withoutOffers();
  }
}
