import { createPlatformClient } from "../client";
import {
  materialCatalogSearchTerms,
  prefilterMaterialCatalog,
  type MaterialCatalogCandidate,
} from "@/lib/content/article-material-offers";
import type { ParsedArticleMaterial } from "@/lib/content/parse-article-materials";

const COLUMNS = "id,slug,title,product_type,is_active,status,medusa_product_id";
const PAGE_SIZE = 40;
const MAX_PAGES_PER_FAMILY = 3;
const MAX_CANDIDATES = 40;
// Internal literals only. Author text never enters the PostgREST filter grammar.
const SEARCH_FAMILIES = [
  ["garen", "yarn", "wol"],
  ["haaknaald", "crochet hook"],
  ["stopnaald", "darning needle", "tapestry needle"],
  ["meetlint", "measuring tape", "tape measure"],
  ["schaar", "scissors"],
];

/** Optional read-only discovery, never approved requirements or persisted links.
 * At most 15 SELECTs / 600 scanned rows; each family owns a 120-row window.
 * Filter and deduplicate before filling a fair, at-most-40 commerce batch.
 */
export async function listArticleMaterialProducts(
  materials: ParsedArticleMaterial[],
): Promise<MaterialCatalogCandidate[]> {
  const needed = new Set(materialCatalogSearchTerms(materials));
  const families = SEARCH_FAMILIES.filter(terms => terms.some(term => needed.has(term)));
  if (!families.length) return [];

  try {
    const supabase = createPlatformClient();
    const buckets: MaterialCatalogCandidate[][] = [];
    for (const terms of families) {
      const rows: MaterialCatalogCandidate[] = [];
      for (let page = 0; page < MAX_PAGES_PER_FAMILY; page++) {
        const start = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("products")
          .select(COLUMNS)
          .eq("is_active", true)
          .eq("status", "active")
          .in("product_type", ["supply"])
          .not("medusa_product_id", "is", null)
          .or(terms.map(term => `title.ilike.%${term}%`).join(","))
          .order("id", { ascending: true })
          .range(start, start + PAGE_SIZE - 1);
        // An incomplete read cannot establish trustworthy runtime suggestions.
        if (error || !Array.isArray(data)) return [];
        rows.push(...data as MaterialCatalogCandidate[]);
        if (data.length < PAGE_SIZE) break;
      }
      buckets.push(rows);
    }

    // Conflicting identities fail closed, including conflicts across families.
    const signatures = new Map<string, string>();
    const conflicts = new Set<string>();
    for (const row of buckets.flat()) {
      const signature = JSON.stringify(row);
      const previous = signatures.get(row.id);
      if (previous !== undefined && previous !== signature) conflicts.add(row.id);
      signatures.set(row.id, signature);
    }
    const eligibleBuckets = buckets.map(rows =>
      prefilterMaterialCatalog(materials, rows.filter(row => !conflicts.has(row.id)))
    );
    const selected = new Map<string, MaterialCatalogCandidate>();
    // Round-robin preserves tools even with a much larger yarn catalog.
    for (let index = 0; index < MAX_CANDIDATES && selected.size < MAX_CANDIDATES; index++) {
      for (const rows of eligibleBuckets) {
        const candidate = rows[index];
        if (candidate) selected.set(candidate.id, candidate);
        if (selected.size === MAX_CANDIDATES) break;
      }
    }
    return [...selected.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  } catch {
    return [];
  }
}
