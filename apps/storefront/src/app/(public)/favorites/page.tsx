import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { listFavoritesByUser } from "@/lib/platform/queries/favorites";
import { createPlatformClient } from "@/lib/platform/client";
import type { EntityType } from "@/types/platform";
import type { Metadata } from "next";

type FavoriteItem = {
  id: string;
  title: string;
  href: string;
  entityType: EntityType;
};

const SECTION_LABELS: Record<EntityType, string> = {
  domain: "Domeinen",
  creator: "Creators",
  product: "Producten",
  workshop: "Workshops",
  event: "Events",
  article: "Artikelen",
  project: "Projecten",
};

export const metadata: Metadata = {
  title: "Favorieten | Hobbysalon",
  description: "Je opgeslagen favorieten op Hobbysalon",
};

export default async function FavoritesPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/favorites");
  }

  const favorites = await listFavoritesByUser(user.id);
  const supabase = createPlatformClient();
  const idsByType = favorites.reduce<Record<EntityType, string[]>>(
    (acc, favorite) => {
      acc[favorite.entity_type].push(favorite.entity_id);
      return acc;
    },
    {
      domain: [],
      creator: [],
      product: [],
      workshop: [],
      event: [],
      article: [],
      project: [],
    }
  );

  const [
    domainsResult,
    creatorsResult,
    productsResult,
    workshopsResult,
    eventsResult,
    articlesResult,
    projectsResult,
  ] = await Promise.all([
    idsByType.domain.length > 0
      ? supabase.from("domains").select("id, slug, name").in("id", idsByType.domain)
      : Promise.resolve({ data: [] }),
    idsByType.creator.length > 0
      ? supabase
          .from("creators")
          .select("id, slug, display_name")
          .in("id", idsByType.creator)
      : Promise.resolve({ data: [] }),
    idsByType.product.length > 0
      ? supabase.from("products").select("id, slug, title").in("id", idsByType.product)
      : Promise.resolve({ data: [] }),
    idsByType.workshop.length > 0
      ? supabase
          .from("workshops")
          .select("id, slug, title")
          .in("id", idsByType.workshop)
      : Promise.resolve({ data: [] }),
    idsByType.event.length > 0
      ? supabase.from("events").select("id, slug, title").in("id", idsByType.event)
      : Promise.resolve({ data: [] }),
    idsByType.article.length > 0
      ? supabase.from("articles").select("id, slug, title").in("id", idsByType.article)
      : Promise.resolve({ data: [] }),
    idsByType.project.length > 0
      ? supabase.from("projects").select("id, slug, title").in("id", idsByType.project)
      : Promise.resolve({ data: [] }),
  ]);

  const itemByKey = new Map<string, FavoriteItem>();

  for (const domain of domainsResult.data ?? []) {
    itemByKey.set(`domain:${domain.id}`, {
      id: domain.id,
      title: domain.name,
      href: `/${domain.slug}`,
      entityType: "domain",
    });
  }
  for (const creator of creatorsResult.data ?? []) {
    itemByKey.set(`creator:${creator.id}`, {
      id: creator.id,
      title: creator.display_name,
      href: `/creator/${creator.slug}`,
      entityType: "creator",
    });
  }
  for (const product of productsResult.data ?? []) {
    itemByKey.set(`product:${product.id}`, {
      id: product.id,
      title: product.title,
      href: `/product/${product.slug}`,
      entityType: "product",
    });
  }
  for (const workshop of workshopsResult.data ?? []) {
    itemByKey.set(`workshop:${workshop.id}`, {
      id: workshop.id,
      title: workshop.title,
      href: `/workshop/${workshop.slug}`,
      entityType: "workshop",
    });
  }
  for (const event of eventsResult.data ?? []) {
    itemByKey.set(`event:${event.id}`, {
      id: event.id,
      title: event.title,
      href: `/agenda/${event.slug}`,
      entityType: "event",
    });
  }
  for (const article of articlesResult.data ?? []) {
    itemByKey.set(`article:${article.id}`, {
      id: article.id,
      title: article.title,
      href: `/artikel/${article.slug}`,
      entityType: "article",
    });
  }
  for (const project of projectsResult.data ?? []) {
    itemByKey.set(`project:${project.id}`, {
      id: project.id,
      title: project.title,
      href: `/project/${project.slug}`,
      entityType: "project",
    });
  }

  const grouped = favorites.reduce<Record<EntityType, FavoriteItem[]>>(
    (acc, favorite) => {
      const key = `${favorite.entity_type}:${favorite.entity_id}`;
      const item = itemByKey.get(key);
      if (item) {
        acc[favorite.entity_type].push(item);
      }
      return acc;
    },
    {
      domain: [],
      creator: [],
      product: [],
      workshop: [],
      event: [],
      article: [],
      project: [],
    }
  );

  const totalItems = Object.values(grouped).reduce(
    (sum, list) => sum + list.length,
    0
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Mijn favorieten</h1>
      <p className="mt-2 text-[var(--muted)]">
        {totalItems} opgeslagen item{totalItems !== 1 ? "s" : ""}.
      </p>

      {totalItems === 0 ? (
        <p className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-[var(--muted)]">
          Je hebt nog geen favorieten toegevoegd.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {(Object.keys(SECTION_LABELS) as EntityType[]).map((entityType) => {
            const items = grouped[entityType];
            if (items.length === 0) return null;
            return (
              <section
                key={entityType}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
              >
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {SECTION_LABELS[entityType]}
                </h2>
                <ul className="mt-3 space-y-2">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="text-[var(--accent)] underline">
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
