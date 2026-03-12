import Link from "next/link";
import { cn } from "@/lib/utils";
import { CardShell } from "@/components/ui/card-shell";
import { AspectImage } from "@/components/ui/aspect-image";
import { DifficultyIndicator } from "@/components/domain/difficulty-indicator";
import type { Project } from "@/types/platform";

type ProjectCardProps = {
  project: Project;
  className?: string;
};

function ProjectCard({ project, className }: ProjectCardProps) {
  return (
    <Link href={`/project/${project.slug}`} className={cn("block", className)}>
      <CardShell variant="interactive" padding="md">
        <AspectImage
          ratio="video"
          src={project.featured_image_url}
          alt={project.title}
          fallbackImage="placeholderProject"
          className="-mx-4 -mt-4 mb-3"
        />
        <DifficultyIndicator level={project.difficulty_level} />
        <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)] line-clamp-2">
          {project.title}
        </h3>
        {project.short_description && (
          <p className="mt-1 text-sm text-[var(--muted)] line-clamp-3">
            {project.short_description}
          </p>
        )}
      </CardShell>
    </Link>
  );
}

export { ProjectCard };
export type { ProjectCardProps };
