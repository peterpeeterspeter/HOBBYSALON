import Link from "next/link";
import { notFound } from "next/navigation";
import { getDomainPageData } from "@/lib/services/domain-page";
import { ProductCard } from "@/components/shared/ProductCard";
import { CreatorCard } from "@/components/shared/CreatorCard";
import { WorkshopCard } from "@/components/shared/WorkshopCard";
import { EventCard } from "@/components/shared/EventCard";
import { ArticleCard } from "@/components/shared/ArticleCard";
import { Section } from "@/components/shared/Section";
import { FavoriteToggleButton } from "@/components/shared/FavoriteToggleButton";
import { getAuthUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/platform/queries/favorites";
import type { Metadata } from "next";

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain: slug } = await params;
  const { domain } = await getDomainPageData(slug);
  if (!domain) return { title: "Niet gevonden" };
  return {
    title: domain.seo_title ?? `${domain.name} | Hobbysalon`,
    description: domain.seo_description ?? domain.short_description ?? undefined,
  };
}

export default async function DomainPage({ params }: Props) {
  const { domain: slug } = await params;
  const data = await getDomainPageData(slug);

  if (!data.domain) notFound();

  const { domain, creators, handmadeProducts, supplyProducts } = data;
  const user = await getAuthUser();
  const domainIsFavorite = user
    ? await isFavorite(user.id, "domain", domain.id)
    : false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          {domain.name}
        </h1>
        {domain.short_description && (
          <p className="mt-2 text-lg text-[var(--muted)]">
            {domain.short_description}
          </p>
        )}
        {domain.hero_image_url && (
          <div className="mt-6 aspect-video overflow-hidden rounded-lg bg-[var(--border)]">
            <img
              src={domain.hero_image_url}
              alt={domain.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="mt-4">
          <FavoriteToggleButton
            entityType="domain"
            entityId={domain.id}
            isFavorited={domainIsFavorite}
            nextPath={`/${domain.slug}`}
          />
        </div>
      </header>

      <Section title="Makers & leveranciers">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
          {creators.length === 0 && (
            <p className="col-span-full text-[var(--muted)]">
              Nog geen creators in dit domein.
            </p>
          )}
        </div>
      </Section>

      <Section title="Handgemaakt">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {handmadeProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          {handmadeProducts.length === 0 && (
            <p className="col-span-full text-[var(--muted)]">
              Nog geen handgemaakte producten.
            </p>
          )}
        </div>
        {handmadeProducts.length > 0 && (
          <div className="mt-4">
            <Link
              href={`/${domain.slug}/handmade`}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Alle handgemaakte producten →
            </Link>
          </div>
        )}
      </Section>

      <Section title="Benodigdheden">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {supplyProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          {supplyProducts.length === 0 && (
            <p className="col-span-full text-[var(--muted)]">
              Nog geen benodigdheden.
            </p>
          )}
        </div>
        {supplyProducts.length > 0 && (
          <div className="mt-4">
            <Link
              href={`/${domain.slug}/supplies`}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Alle benodigdheden →
            </Link>
          </div>
        )}
      </Section>

      <Section title="Workshops">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.workshops.map((w) => (
            <WorkshopCard key={w.id} workshop={w} />
          ))}
          {data.workshops.length === 0 && (
            <p className="col-span-full text-[var(--muted)]">
              Nog geen workshops in dit domein.
            </p>
          )}
        </div>
        {data.workshops.length > 0 && (
          <div className="mt-4">
            <Link
              href={`/${domain.slug}/workshops`}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Alle workshops bekijken →
            </Link>
          </div>
        )}
      </Section>

      <Section title="Evenementen">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
          {data.events.length === 0 && (
            <p className="col-span-full text-[var(--muted)]">
              Nog geen evenementen in dit domein.
            </p>
          )}
        </div>
        {data.events.length > 0 && (
          <div className="mt-4">
            <Link
              href="/agenda"
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Volledige agenda bekijken →
            </Link>
          </div>
        )}
      </Section>

      <Section title="Inspiratie & artikelen">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
          {data.articles.length === 0 && (
            <p className="col-span-full text-[var(--muted)]">
              Nog geen artikelen in dit domein.
            </p>
          )}
        </div>
        {data.articles.length > 0 && (
          <div className="mt-4">
            <Link
              href={`/${domain.slug}/artikels`}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Alle artikelen bekijken →
            </Link>
          </div>
        )}
      </Section>
    </div>
  );
}
