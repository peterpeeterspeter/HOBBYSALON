import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { listWorkshopsByCreator } from "@/lib/platform/queries/workshops";
import { listEventsByCreator } from "@/lib/platform/queries/events";
import { listArticlesByAuthor } from "@/lib/platform/queries/articles";
import { createPlatformClient } from "@/lib/platform/client";
import {
  createCreatorEntityLinkAction,
  deleteCreatorEntityLinkAction,
  saveCreatorProfileAction,
} from "@/app/actions/dashboard";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const CREATOR_TYPES: Array<{ value: string; label: string }> = [
  { value: "maker", label: "Maker" },
  { value: "workshopgever", label: "Workshopgever" },
  { value: "supplier", label: "Leverancier" },
  { value: "content_creator", label: "Content maker" },
  { value: "organizer", label: "Organisator" },
];

const RELATION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "related", label: "Gerelateerd" },
  { value: "featured", label: "Featured" },
  { value: "recommended", label: "Aanbevolen" },
  { value: "tutorial", label: "Tutorial-link" },
];

type LinkTargetType = "product" | "workshop" | "event" | "article";
type LinkTargetOption = { id: string; label: string };

type CreatorEntityLink = {
  id: string;
  target_entity_type: LinkTargetType;
  target_entity_id: string;
  relation_type: string;
  weight: number;
  sort_order: number | null;
};

function EntityLinkCreateForm({
  targetType,
  title,
  options,
}: {
  targetType: LinkTargetType;
  title: string;
  options: LinkTargetOption[];
}) {
  return (
    <form
      action={createCreatorEntityLinkAction}
      className="rounded-lg border border-[var(--border)] p-3"
    >
      <input type="hidden" name="target_entity_type" value={targetType} />
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      {options.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Nog geen items beschikbaar om te linken.
        </p>
      ) : (
        <>
          <label className="mt-2 block text-xs font-medium text-[var(--muted)]">
            Selecteer item
          </label>
          <select
            name="target_entity_id"
            required
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          >
            <option value="">Kies...</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-[var(--muted)]">
                Relatie
              </label>
              <select
                name="relation_type"
                defaultValue="related"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
              >
                {RELATION_TYPE_OPTIONS.map((relation) => (
                  <option key={relation.value} value={relation.value}>
                    {relation.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted)]">
                Weight
              </label>
              <input
                type="number"
                name="weight"
                min={1}
                max={100}
                defaultValue={1}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted)]">
                Sort order
              </label>
              <input
                type="number"
                name="sort_order"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <Button type="submit" variant="secondary" size="sm" className="mt-3">
            Link toevoegen
          </Button>
        </>
      )}
    </form>
  );
}

export default async function DashboardCreatorPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const creator = user ? await getCreatorByUserId(user.id) : null;
  const domains = await listDomainsBySort();
  const { success, error } = await searchParams;

  let selectedDomainIds = new Set<string>();
  let productOptions: LinkTargetOption[] = [];
  let workshopOptions: LinkTargetOption[] = [];
  let eventOptions: LinkTargetOption[] = [];
  let articleOptions: LinkTargetOption[] = [];
  let entityLinks: CreatorEntityLink[] = [];

  if (creator) {
    const supabase = createPlatformClient();
    const [domainLinksResult, productsResult, workshops, events, articles, linksResult] =
      await Promise.all([
        supabase
          .from("creator_domains")
          .select("domain_id")
          .eq("creator_id", creator.id),
        supabase
          .from("products")
          .select("id,title,status")
          .eq("creator_id", creator.id)
          .order("updated_at", { ascending: false })
          .limit(100),
        listWorkshopsByCreator(creator.id),
        listEventsByCreator(creator.id),
        listArticlesByAuthor(creator.id),
        supabase
          .from("entity_links")
          .select("id,target_entity_type,target_entity_id,relation_type,weight,sort_order")
          .eq("source_entity_type", "creator")
          .eq("source_entity_id", creator.id)
          .in("target_entity_type", ["product", "workshop", "event", "article"])
          .order("sort_order", { ascending: true, nullsFirst: false }),
      ]);

    selectedDomainIds = new Set(
      (domainLinksResult.data ?? []).map((row) => row.domain_id as string)
    );

    productOptions = ((productsResult.data ?? []) as Array<{
      id: string;
      title: string;
      status: string;
    }>).map((product) => ({
      id: product.id,
      label: `${product.title} (${product.status})`,
    }));
    workshopOptions = workshops.map((workshop) => ({
      id: workshop.id,
      label: workshop.title,
    }));
    eventOptions = events.map((event) => ({
      id: event.id,
      label: event.title,
    }));
    articleOptions = articles.map((article) => ({
      id: article.id,
      label: article.title,
    }));
    entityLinks = (linksResult.data ?? []) as CreatorEntityLink[];
  }

  const labelByType: Record<LinkTargetType, Map<string, string>> = {
    product: new Map(productOptions.map((option) => [option.id, option.label])),
    workshop: new Map(workshopOptions.map((option) => [option.id, option.label])),
    event: new Map(eventOptions.map((option) => [option.id, option.label])),
    article: new Map(articleOptions.map((option) => [option.id, option.label])),
  };

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Creator dashboard</h1>
      <p className="text-[var(--muted)]">Beheer je creator-profiel en publieke info.</p>

      {success && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <CardShell variant="default" padding="lg">
        <form action={saveCreatorProfileAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="display_name"
              label="Naam *"
              required
              defaultValue={creator?.display_name ?? ""}
            />
            <Input
              name="slug"
              label="Slug"
              defaultValue={creator?.slug ?? ""}
            />
            <Input
              name="business_name"
              label="Bedrijfsnaam"
              defaultValue={creator?.business_name ?? ""}
            />
            <Input
              name="city"
              label="Stad"
              defaultValue={creator?.city ?? ""}
            />
            <Input
              name="website_url"
              label="Website"
              defaultValue={creator?.website_url ?? ""}
            />
            <Input
              name="instagram_url"
              label="Instagram"
              defaultValue={creator?.instagram_url ?? ""}
            />
            <Input
              name="facebook_url"
              label="Facebook"
              defaultValue={creator?.facebook_url ?? ""}
            />
            <Input
              name="avatar_url"
              label="Avatar URL"
              defaultValue={creator?.avatar_url ?? ""}
            />
            <Input
              name="banner_url"
              label="Banner URL"
              defaultValue={creator?.banner_url ?? ""}
            />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Bio
              </label>
              <textarea
                name="bio"
                rows={4}
                defaultValue={creator?.bio ?? ""}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Rollen</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {CREATOR_TYPES.map((type) => (
                <label
                  key={type.value}
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5"
                >
                  <input
                    type="checkbox"
                    name="creator_types"
                    value={type.value}
                    defaultChecked={creator?.creator_types?.includes(type.value)}
                  />
                  <span className="text-sm">{type.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Hobby-domeinen</legend>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Deze domeinen bepalen waar je zichtbaar bent op discovery-pagina&apos;s.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {domains.map((domain) => (
                <label
                  key={domain.id}
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5"
                >
                  <input
                    type="checkbox"
                    name="domain_ids"
                    value={domain.id}
                    defaultChecked={selectedDomainIds.has(domain.id)}
                  />
                  <span className="text-sm">{domain.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit" className="mt-6">
            Profiel opslaan
          </Button>
        </form>
      </CardShell>

      {creator && (
        <CardShell variant="default" padding="lg">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Entity links
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Koppel je eigen content zodat je creator-pagina als discovery-hub werkt.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <EntityLinkCreateForm
              targetType="product"
              title="Creator -> Product"
              options={productOptions}
            />
            <EntityLinkCreateForm
              targetType="workshop"
              title="Creator -> Workshop"
              options={workshopOptions}
            />
            <EntityLinkCreateForm
              targetType="event"
              title="Creator -> Event"
              options={eventOptions}
            />
            <EntityLinkCreateForm
              targetType="article"
              title="Creator -> Artikel"
              options={articleOptions}
            />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Bestaande links
            </h3>
            {entityLinks.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Nog geen entity links voor deze creator.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {entityLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-[var(--foreground)]">
                        {link.target_entity_type} {"->"}{" "}
                        {labelByType[link.target_entity_type].get(link.target_entity_id) ??
                          link.target_entity_id}
                      </p>
                      <p className="text-[var(--muted)]">
                        relatie: {link.relation_type} · weight: {link.weight}
                        {link.sort_order !== null ? ` · sort: ${link.sort_order}` : ""}
                      </p>
                    </div>
                    <form action={deleteCreatorEntityLinkAction}>
                      <input type="hidden" name="entity_link_id" value={link.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Verwijderen
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardShell>
      )}
    </section>
  );
}
