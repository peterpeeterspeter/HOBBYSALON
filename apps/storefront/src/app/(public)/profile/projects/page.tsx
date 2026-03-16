import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { listProjectsByUserId } from "@/lib/platform/queries/projects";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Mijn projecten | Hobbysalon",
  description: "Beheer je hobbyprojecten en materialen.",
};

export default async function ProfileProjectsPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/profile/projects");
  }

  const projects = await listProjectsByUserId(user.id);

  return (
    <PageLayout
      title="Mijn projecten"
      description="Upload en beheer je hobbyprojecten. Voeg materialen toe uit de webshop of als gezocht."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-[var(--muted)]">
            {projects.length === 0
              ? "Nog geen projecten. Maak je eerste project aan."
              : `${projects.length} project${projects.length === 1 ? "" : "en"}`}
          </p>
          <Button asChild>
            <Link href="/profile/projects/new">Nieuw project</Link>
          </Button>
        </div>

        {projects.length === 0 ? (
          <CardShell variant="default" padding="lg">
            <p className="text-[var(--muted)]">
              Je hebt nog geen projecten. Klik op &quot;Nieuw project&quot; om te beginnen.
            </p>
            <Button asChild className="mt-4">
              <Link href="/profile/projects/new">Nieuw project</Link>
            </Button>
          </CardShell>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <CardShell variant="default" padding="lg" className="h-full">
                  {project.featured_image_url ? (
                    <Link href={`/project/${project.slug}`} className="block">
                      <img
                        src={project.featured_image_url}
                        alt=""
                        className="aspect-video w-full rounded-lg object-cover"
                      />
                    </Link>
                  ) : (
                    <div className="aspect-video w-full rounded-lg bg-[var(--muted)]/20" />
                  )}
                  <h3 className="mt-3 font-semibold text-[var(--foreground)]">
                    <Link href={`/project/${project.slug}`} className="hover:underline">
                      {project.title}
                    </Link>
                  </h3>
                  {project.short_description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                      {project.short_description}
                    </p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/profile/projects/${project.id}/edit`}>Bewerken</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/project/${project.slug}`}>Bekijken</Link>
                    </Button>
                  </div>
                </CardShell>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageLayout>
  );
}
