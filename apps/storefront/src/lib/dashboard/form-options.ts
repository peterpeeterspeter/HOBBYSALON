import "server-only";

import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { listWorkshopCategories } from "@/lib/platform/queries/workshop-categories";
import { createPlatformClient } from "@/lib/platform/client";

/** Domain list + creator's first domain, used as default in every offer form. */
export async function loadOfferFormOptions(creatorId: string) {
  const supabase = createPlatformClient();
  const [domains, workshopCategories, creatorDomains] = await Promise.all([
    listDomainsBySort(),
    listWorkshopCategories({ activeOnly: true }),
    supabase.from("creator_domains").select("domain_id").eq("creator_id", creatorId),
  ]);
  const domainOptions = domains.map((domain) => ({ value: domain.id, label: domain.name }));
  const primaryDomainId =
    ((creatorDomains.data ?? []) as Array<{ domain_id: string }>)[0]?.domain_id ??
    domains[0]?.id ??
    "";
  return { domainOptions, workshopCategories, primaryDomainId };
}
