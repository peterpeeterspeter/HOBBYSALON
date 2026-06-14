"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProductCard, WorkshopCard, EventCard, ArticleCard } from "@/components/cards";
import { GridLayout } from "@/components/layout/grid-layout";
import type {
  Product,
  Workshop,
  Event,
  Article,
  Domain,
  Creator,
} from "@/types/platform";
import type { CreatorProjectTeaser } from "@/lib/services/creator-page";

type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

type Props = {
  creator: Creator;
  products: ProductWithPrice[];
  domains: Domain[];
  projects: CreatorProjectTeaser[];
  relatedWorkshops: Workshop[];
  relatedEvents: Event[];
  relatedArticles: Article[];
  relatedCreators: Creator[];
};

const CREATOR_TYPE_LABELS: Record<string, string> = {
  maker: "Maker",
  workshopgever: "Workshopgever",
  supplier: "Leverancier",
  content_creator: "Content maker",
  organizer: "Organisator",
};

export function CreatorProfileTabs({
  creator,
  products,
  domains,
  projects,
  relatedWorkshops,
  relatedEvents,
  relatedArticles,
  relatedCreators,
}: Props) {
  const tabs = [
    { key: "workshops", label: "Workshops", count: relatedWorkshops.length },
    { key: "products", label: "Producten", count: products.length },
    { key: "events", label: "Evenementen", count: relatedEvents.length },
    { key: "articles", label: "Artikelen", count: relatedArticles.length },
    { key: "about", label: "Over", count: null },
  ].filter((t) => t.count === null || t.count > 0 || t.key === "about");

  const [activeTab, setActiveTab] = useState(tabs[0].key);

  const types = (creator.creator_types ?? []).map(
    (t) => CREATOR_TYPE_LABELS[t] ?? t
  );

  return (
    <>
      {/* Sticky tab bar */}
      <div className="sticky top-[4rem] z-[90] border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto max-w-6xl px-4">
          <div className="-mb-px flex gap-0 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex shrink-0 items-center gap-2 border-b-[2.5px] px-5 py-3.5 text-[15px] font-semibold transition-colors ${
                  activeTab === tab.key
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--accent)]"
                }`}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[12px] font-bold text-[var(--accent)]">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div id="workshops" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-8">
        {activeTab === "workshops" && (
          <div>
            <p className="mb-6 text-[15px] text-[var(--muted)]">
              {relatedWorkshops.length} workshop{relatedWorkshops.length !== 1 ? "s" : ""}
            </p>
            <GridLayout cols={3} gap="lg">
              {relatedWorkshops.map((w) => (
                <WorkshopCard key={w.id} workshop={w} />
              ))}
            </GridLayout>
          </div>
        )}

        {activeTab === "products" && (
          <div>
            <p className="mb-6 text-[15px] text-[var(--muted)]">
              {products.length} product{products.length !== 1 ? "en" : ""}
            </p>
            <GridLayout cols={4} gap="lg">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </GridLayout>
          </div>
        )}

        {activeTab === "events" && (
          <div>
            <p className="mb-6 text-[15px] text-[var(--muted)]">
              {relatedEvents.length} evenement{relatedEvents.length !== 1 ? "en" : ""}
            </p>
            <GridLayout cols={2} gap="lg">
              {relatedEvents.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </GridLayout>
          </div>
        )}

        {activeTab === "articles" && (
          <div>
            <p className="mb-6 text-[15px] text-[var(--muted)]">
              {relatedArticles.length} artikel{relatedArticles.length !== 1 ? "en" : ""}
            </p>
            <GridLayout cols={3} gap="lg">
              {relatedArticles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </GridLayout>
          </div>
        )}

        {activeTab === "about" && (
          <AboutTab creator={creator} domains={domains} projects={projects} types={types} />
        )}
      </div>

      {/* Related creators */}
      {relatedCreators.length > 0 && (
        <div className="border-t border-[var(--border)] bg-[var(--section-warm)] py-12">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-6 flex items-center gap-3">
              <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--accent)]">
                Creators
              </span>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
                Gerelateerde makers
              </h2>
              <span className="hidden h-px flex-1 bg-[var(--border)] sm:block" />
              <Link
                href="/creators"
                className="text-sm font-semibold text-[var(--accent)] hover:underline"
              >
                Bekijk alle creators →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {relatedCreators.map((c) => (
                <Link
                  key={c.id}
                  href={`/creator/${c.slug}`}
                  className="group rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-5 text-center transition-all hover:border-[var(--accent)] hover:shadow-md"
                >
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--section-warm)] group-hover:border-[var(--accent)]">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--accent)]">
                        {c.display_name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <p className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-[var(--foreground)]">
                    {c.display_name}
                  </p>
                  {c.city && (
                    <p className="mt-1 text-xs text-[var(--muted)]">{c.city}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AboutTab({
  creator,
  domains,
  projects,
  types,
}: {
  creator: Creator;
  domains: Domain[];
  projects: CreatorProjectTeaser[];
  types: string[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      {/* Left: bio + projects */}
      <div className="space-y-6">
        {creator.bio && (
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
              Over {creator.display_name}
            </h3>
            <p className="text-[15px] leading-relaxed text-[var(--foreground)]">
              {creator.bio}
            </p>
            {(types.length > 0 || domains.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {types.map((t) => (
                  <Badge key={t} variant="format">{t}</Badge>
                ))}
                {domains.map((d) => (
                  <Link key={d.id} href={`/${d.slug}`}>
                    <Badge variant="domain" className="cursor-pointer hover:opacity-90">{d.name}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {projects.length > 0 && (
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="mb-4 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
              Afgewerkte creaties
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {projects.slice(0, 6).map(({ project, galleryPreviewUrl }) => (
                <Link
                  key={project.id}
                  href={`/project/${project.slug}`}
                  className="group overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] transition-all hover:border-[var(--accent)]"
                >
                  <div className="aspect-square overflow-hidden bg-[var(--section-warm)]">
                    {galleryPreviewUrl ? (
                      <img
                        src={galleryPreviewUrl}
                        alt={project.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
                        Geen foto
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                      {project.title}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: location + social links */}
      <div className="space-y-4">
        {(creator.city || creator.country_code) && (
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--foreground)]">
              Werklocatie
            </h3>
            <div className="flex flex-col gap-2 text-[15px] text-[var(--foreground)]">
              {creator.city && (
                <span className="inline-flex items-center gap-2">
                  <MapPin size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
                  {creator.city}
                  {creator.country_code ? `, ${creator.country_code}` : ""}
                </span>
              )}
            </div>
          </div>
        )}

        {(creator.website_url || creator.instagram_url || creator.facebook_url) && (
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--foreground)]">
              Sociale media & website
            </h3>
            <div className="flex flex-col gap-2">
              {creator.website_url && (
                <SocialLink href={creator.website_url} label="Website" handle={creator.website_url.replace(/^https?:\/\//, "")} />
              )}
              {creator.instagram_url && (
                <SocialLink href={creator.instagram_url} label="Instagram" handle={creator.instagram_url.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "")} />
              )}
              {creator.facebook_url && (
                <SocialLink href={creator.facebook_url} label="Facebook" handle={creator.display_name} />
              )}
            </div>
          </div>
        )}

        {!creator.bio && domains.length > 0 && (
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="mb-3 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--foreground)]">
              Hobby&apos;s & expertise
            </h3>
            <div className="flex flex-wrap gap-2">
              {domains.map((d) => (
                <Link key={d.id} href={`/${d.slug}`}>
                  <Badge variant="domain" className="cursor-pointer hover:opacity-90">{d.name}</Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SocialLink({ href, label, handle }: { href: string; label: string; handle: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="group flex items-center gap-3 rounded-lg bg-[var(--background)] px-4 py-2.5 transition-colors hover:bg-[var(--accent)]/8 hover:text-[var(--accent)]"
    >
      <ExternalLink size={15} className="shrink-0 text-[var(--muted)] group-hover:text-[var(--accent)]" aria-hidden />
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">{label}</p>
        <p className="truncate text-[12px] text-[var(--muted)]">{handle}</p>
      </div>
    </a>
  );
}
