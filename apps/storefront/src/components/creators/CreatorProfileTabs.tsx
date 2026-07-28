"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  Product,
  Workshop,
  Article,
  Domain,
  Creator,
} from "@/types/platform";
import type {
  CreatorProjectTeaser,
  CreatorEventWithRole,
} from "@/lib/services/creator-page";

type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

type Props = {
  creator: Creator;
  products: ProductWithPrice[];
  domains: Domain[];
  projects: CreatorProjectTeaser[];
  relatedWorkshops: Workshop[];
  relatedEvents: CreatorEventWithRole[];
  relatedArticles: Article[];
  relatedCreators: Creator[];
  showExternalLinks?: boolean;
};

const CREATOR_TYPE_LABELS: Record<string, string> = {
  maker: "Maker",
  workshopgever: "Workshopgever",
  supplier: "Leverancier",
  content_creator: "Content maker",
  organizer: "Organisator",
};

const EVENT_ROLE_LABELS: Record<string, string> = {
  vendor: "Standhouder",
  workshop_host: "Workshopgever",
  speaker: "Spreker",
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
  showExternalLinks = true,
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
            <p className="mb-4 text-[15px] text-[var(--muted)]">
              {relatedWorkshops.length} workshop{relatedWorkshops.length !== 1 ? "s" : ""}
            </p>
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {relatedWorkshops.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/workshop/${w.slug}`}
                    className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
                  >
                    <div className="hidden h-16 w-24 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
                      {w.featured_image_url ? (
                        <img
                          src={w.featured_image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--muted)]">
                        {w.city?.trim() || w.location_name?.trim() || "Workshop"}
                      </p>
                      <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                        {w.title}
                      </h3>
                    </div>
                    <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
                      Bekijk
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === "products" && (
          <div>
            <p className="mb-4 text-[15px] text-[var(--muted)]">
              {products.length} product{products.length !== 1 ? "en" : ""}
            </p>
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {products.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/product/${p.slug}`}
                    className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:h-20 sm:w-20">
                      {p.featured_image_url ? (
                        <img
                          src={p.featured_image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                        {p.title}
                      </h3>
                      {p.short_description ? (
                        <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                          {p.short_description}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
                      Bekijk
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === "events" && (
          <div>
            <p className="mb-4 text-[15px] text-[var(--muted)]">
              {relatedEvents.length} evenement{relatedEvents.length !== 1 ? "en" : ""}
            </p>
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {relatedEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/agenda/${e.slug}`}
                    className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
                  >
                    <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
                      {e.featured_image_url ? (
                        <img
                          src={e.featured_image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--muted)]">
                        {e.participationRole
                          ? EVENT_ROLE_LABELS[e.participationRole] ?? e.participationRole
                          : e.city?.trim() || e.location_name?.trim() || "Evenement"}
                      </p>
                      <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                        {e.title}
                      </h3>
                    </div>
                    <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
                      Bekijk
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === "articles" && (
          <div>
            <p className="mb-4 text-[15px] text-[var(--muted)]">
              {relatedArticles.length} artikel{relatedArticles.length !== 1 ? "en" : ""}
            </p>
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {relatedArticles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/artikel/${a.slug}`}
                    className="group flex items-start gap-4 py-4 transition-colors hover:bg-[var(--section-highlight)]/80 sm:px-2"
                  >
                    <div className="hidden h-16 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-[var(--section-alt)] sm:block">
                      {a.featured_image_url ? (
                        <img
                          src={a.featured_image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                        {a.title}
                      </h3>
                      {a.excerpt ? (
                        <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                          {a.excerpt}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[15px] font-bold text-[var(--accent)]">
                      Lees
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === "about" && (
          <AboutTab
            creator={creator}
            domains={domains}
            projects={projects}
            types={types}
            showExternalLinks={showExternalLinks}
          />
        )}
      </div>

      {/* Related creators */}
      {relatedCreators.length > 0 && (
        <div className="border-t border-[var(--border)] bg-[var(--section-alt)] py-12">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
                Gerelateerde makers
              </h2>
              <Link
                href="/creators"
                className="text-sm font-semibold text-[var(--accent)] hover:underline"
              >
                Bekijk alle creators
              </Link>
            </div>
            <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
              {relatedCreators.map((c) => (
                <Link
                  key={c.id}
                  href={`/creator/${c.slug}`}
                  className="group w-36 shrink-0 sm:w-40"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-[var(--section-warm)]">
                    {c.avatar_url ? (
                      <img
                        src={c.avatar_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--accent)]">
                        {c.display_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 font-[family-name:var(--font-heading)] text-[15px] font-semibold text-[var(--foreground)] line-clamp-2">
                    {c.display_name}
                  </p>
                  {c.city && (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{c.city}</p>
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
  showExternalLinks,
}: {
  creator: Creator;
  domains: Domain[];
  projects: CreatorProjectTeaser[];
  types: string[];
  showExternalLinks: boolean;
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

        {showExternalLinks &&
          (creator.website_url || creator.instagram_url || creator.facebook_url) && (
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

        {!showExternalLinks && (
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-[14px] text-[var(--muted)]">
              Ontdek het aanbod van {creator.display_name} via Hobbysalon. Producten,
              workshops en contact verlopen via ons platform.
            </p>
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
