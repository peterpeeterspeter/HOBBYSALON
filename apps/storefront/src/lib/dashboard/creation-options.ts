import "server-only";

import { listSupplyCategoryOptions } from "@/lib/platform/queries/products";

export async function loadCreationCategories() {
  const options = await listSupplyCategoryOptions();
  return options.map((category) => ({
    id: category.id,
    name: category.name,
    domain_id: category.domain_id,
  }));
}
