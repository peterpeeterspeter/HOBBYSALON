import Link from "next/link";
import type { CommunityGalleryProject } from "@/lib/content/community-gallery";

type Props = { projects: CommunityGalleryProject[] };

export function CommunityGallery({ projects }: Props) {
  if (projects.length === 0) return null;

  return (
    <section aria-labelledby="community-gallery-heading" className="mb-12">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">Gemaakt door onze community</p>
        <h2 id="community-gallery-heading" className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
          Bekijk afgewerkte creaties
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Deze foto&apos;s zijn door hun makers gedeeld en door Hobbysalon goedgekeurd.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const image = project.images[0];
          if (!image) return null;
          return (
            <Link key={project.projectId} href={`/project/${project.projectSlug}`} className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
              <img src={image.url} alt={image.altText ?? `Creatie: ${project.projectTitle}`} className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
              <p className="px-4 py-3 text-sm font-semibold text-[var(--foreground)]">{project.projectTitle}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
