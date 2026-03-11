import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/platform";

type ProjectCardProps = {
  project: Project;
  className?: string;
};

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Gevorderd",
  advanced: "Expert",
};

export function ProjectCard({ project, className }: ProjectCardProps) {
  return (
    <Link
      href={`/project/${project.slug}`}
      className={cn(
        "block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md",
        className
      )}
    >
      <div className="aspect-video mb-3 overflow-hidden rounded-md bg-[var(--border)]">
        {project.featured_image_url ? (
          <img
            src={project.featured_image_url}
            alt={project.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--muted)] text-sm">
            Project
          </div>
        )}
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
        {DIFFICULTY_LABELS[project.difficulty_level] ?? project.difficulty_level}
      </span>
      <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
        {project.title}
      </h3>
      {project.short_description && (
        <p className="mt-1 text-sm text-[var(--muted)] line-clamp-3">
          {project.short_description}
        </p>
      )}
    </Link>
  );
}
