import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { PriceDisplay } from "@/components/domain/price-display";
import { DateDisplay } from "@/components/domain/date-display";
import type { Article, Creator, Workshop } from "@/types/platform";
import type {
  CreatorEventWithRole,
  CreatorProjectTeaser,
  ProductWithPrice,
} from "@/lib/services/creator-page";

const FORMAT_LABELS: Record<string, string> = {
  physical: "Op locatie",
  online: "Online",
  hybrid: "Op locatie of online",
};

const EVENT_ROLE_LABELS: Record<string, string> = {
  vendor: "Standhouder",
  workshop_host: "Geeft een workshop",
  speaker: "Spreker",
  organizer: "Organisator",
};

const cardClass =
  "group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-colors duration-300 hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function ProfileSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="mb-6 max-w-2xl">
        <h2
          id={`${id}-title`}
          className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)] [text-wrap:balance] sm:text-3xl"
        >
          {title}
        </h2>
        {lead ? (
          <p className="mt-2 text-lg text-[var(--muted)] [text-wrap:pretty]">{lead}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function CardImage({
  src,
  alt,
  ratio,
  keepSpace = false,
}: {
  src: string | null;
  alt: string;
  ratio: string;
  keepSpace?: boolean;
}) {
  if (!src && !keepSpace) return null;
  return (
    <div className={`${ratio} overflow-hidden bg-[var(--section-warm)]`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}

export function WorkshopGrid({ workshops }: { workshops: Workshop[] }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {workshops.map((w) => {
        const place =
          w.format_type === "online"
            ? "Online"
            : w.city?.trim() || w.location_name?.trim() || null;
        return (
          <li key={w.id}>
            <Link href={`/workshop/${w.slug}`} className={cardClass}>
              <CardImage src={w.featured_image_url} alt="" ratio="aspect-[4/3]" />
              <div className="flex flex-1 flex-col p-6">
                <p className="text-base font-semibold text-[var(--muted)]">
                  {FORMAT_LABELS[w.format_type] ?? "Workshop"}
                  {place && w.format_type !== "online" ? ` · ${place}` : null}
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                  {w.title}
                </h3>
                {w.short_description ? (
                  <p className="mt-2 text-base text-[var(--muted)] line-clamp-2">
                    {w.short_description}
                  </p>
                ) : null}
                <div className="mt-auto flex items-end justify-between gap-4 pt-4">
                  {w.price_cents > 0 ? (
                    <PriceDisplay amount={w.price_cents} currencyCode={w.currency_code} size="lg" />
                  ) : (
                    <span className="text-lg font-semibold text-[var(--foreground)]">Gratis</span>
                  )}
                  <span className="text-base font-bold text-[var(--accent)]">Bekijk en boek</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ProductGrid({ products }: { products: ProductWithPrice[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}>
          <Link href={`/product/${p.slug}`} className={cardClass}>
            <CardImage src={p.featured_image_url} alt="" ratio="aspect-square" keepSpace />
            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                {p.title}
              </h3>
              <div className="mt-auto pt-3">
                {p.price && p.price.amount > 0 ? (
                  <PriceDisplay
                    amount={p.price.amount}
                    currencyCode={p.price.currency_code}
                    size="lg"
                  />
                ) : (
                  <span className="text-base font-semibold text-[var(--muted)]">
                    Vraag de prijs
                  </span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProjectGrid({ projects }: { projects: CreatorProjectTeaser[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
      {projects.slice(0, 6).map(({ project, galleryPreviewUrl }) => (
        <li key={project.id}>
          <Link href={`/project/${project.slug}`} className={cardClass}>
            <CardImage src={galleryPreviewUrl} alt={project.title} ratio="aspect-square" keepSpace />
            <p className="p-4 text-base font-semibold text-[var(--foreground)] line-clamp-2">
              {project.title}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function EventList({ events }: { events: CreatorEventWithRole[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {events.map((e) => {
        const role = e.participationRole
          ? EVENT_ROLE_LABELS[e.participationRole] ?? null
          : null;
        const place = e.city?.trim() || e.location_name?.trim() || null;
        return (
          <li key={e.id}>
            <Link
              href={`/agenda/${e.slug}`}
              className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors duration-300 hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:gap-6"
            >
              <div className="w-24 shrink-0 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--accent)] sm:w-32 sm:text-xl">
                <DateDisplay date={e.starts_at} format="short" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                  {e.title}
                </h3>
                <p className="mt-1 text-base text-[var(--muted)]">
                  {[role, place].filter(Boolean).join(" · ") || "Evenement"}
                </p>
              </div>
              <span className="hidden shrink-0 text-base font-bold text-[var(--accent)] sm:inline">
                Bekijk
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ArticleGrid({ articles }: { articles: Article[] }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <li key={a.id}>
          <Link href={`/artikel/${a.slug}`} className={cardClass}>
            <CardImage src={a.featured_image_url} alt="" ratio="aspect-video" />
            <div className="flex flex-1 flex-col p-6">
              <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-hover)]">
                {a.title}
              </h3>
              {a.excerpt ? (
                <p className="mt-2 text-base text-[var(--muted)] line-clamp-3">{a.excerpt}</p>
              ) : null}
              <span className="mt-auto pt-4 text-base font-bold text-[var(--accent)]">
                {a.reading_time_minutes ? `Lees in ${a.reading_time_minutes} min` : "Lees verder"}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AboutBlock({
  creator,
  showBio,
  showExternalLinks,
}: {
  creator: Creator;
  /** False when the bio is one line: the hero already shows it. */
  showBio: boolean;
  showExternalLinks: boolean;
}) {
  const links = showExternalLinks
    ? [
        creator.website_url && {
          href: creator.website_url,
          label: "Website",
          handle: creator.website_url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        },
        creator.instagram_url && {
          href: creator.instagram_url,
          label: "Instagram",
          handle: creator.instagram_url
            .replace(/^https?:\/\/(www\.)?instagram\.com\//, "@")
            .replace(/\/$/, ""),
        },
        creator.facebook_url && {
          href: creator.facebook_url,
          label: "Facebook",
          handle: creator.display_name,
        },
      ].filter((l): l is { href: string; label: string; handle: string } => Boolean(l))
    : [];

  return (
    <div className={showBio ? "grid gap-6 lg:grid-cols-[2fr_1fr]" : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"}>
      {showBio && creator.bio ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <p className="whitespace-pre-line text-lg leading-relaxed text-[var(--foreground)] [text-wrap:pretty]">
            {creator.bio}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {creator.city ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
              Werkt vanuit
            </h3>
            <p className="mt-2 inline-flex items-center gap-2 text-lg text-[var(--foreground)]">
              <MapPin size={18} className="shrink-0 text-[var(--accent)]" aria-hidden />
              {creator.city}
              {creator.country_code ? `, ${creator.country_code}` : ""}
            </p>
          </div>
        ) : null}

        {links.length > 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
              Meer van {creator.display_name}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex min-h-12 items-center gap-3 rounded-xl bg-[var(--background)] px-4 py-2 transition-colors duration-300 hover:bg-[var(--section-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    <ExternalLink size={18} className="shrink-0 text-[var(--muted)] group-hover:text-[var(--accent)]" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">
                        {l.label}
                      </span>
                      <span className="block truncate text-sm text-[var(--muted)]">{l.handle}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!showExternalLinks ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="text-base text-[var(--muted)]">
              Workshops, producten en contact met {creator.display_name} verlopen via
              Hobbysalon.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RelatedCreators({ creators }: { creators: Creator[] }) {
  if (creators.length === 0) return null;
  return (
    <section aria-labelledby="related-title" className="border-t border-[var(--border)] bg-[var(--section-alt)] py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2
            id="related-title"
            className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]"
          >
            Makers met dezelfde hobby
          </h2>
          <Link
            href="/creators"
            className="text-base font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
          >
            Bekijk alle makers
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {creators.map((c) => (
            <li key={c.id}>
              <Link href={`/creator/${c.slug}`} className={cardClass}>
                <div className="aspect-square overflow-hidden bg-[var(--section-warm)]">
                  {c.avatar_url ? (
                    <img
                      src={c.avatar_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-[family-name:var(--font-heading)] text-4xl font-bold text-[var(--accent)]">
                      {c.display_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--foreground)] line-clamp-2">
                    {c.display_name}
                  </p>
                  {c.city ? <p className="mt-1 text-base text-[var(--muted)]">{c.city}</p> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
