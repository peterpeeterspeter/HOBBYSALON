import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { createProjectAction } from "@/app/actions/profile-projects";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";

export const metadata: Metadata = {
  title: "Nieuw project | Hobbysalon",
  description: "Maak een nieuw hobbyproject aan.",
};

export default async function ProfileProjectsNewPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/profile/projects/new");
  }

  return (
    <PageLayout
      title="Nieuw project"
      description="Maak een nieuw hobbyproject aan. Je kunt daarna materialen en foto's toevoegen."
    >
      <CardShell variant="default" padding="lg">
        <form action={createProjectAction} encType="multipart/form-data" className="space-y-4">
          <Input name="title" label="Titel *" required placeholder="Bijv. Gebreide sjaal voor beginners" />
          <Input name="slug" label="Slug (optioneel)" placeholder="Wordt automatisch gegenereerd uit titel" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              Korte beschrijving
            </label>
            <textarea
              name="short_description"
              rows={2}
              placeholder="Een korte omschrijving van je project"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              Uitgebreide beschrijving
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder="Wat ga je maken? Welke stappen volg je?"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Moeilijkheidsgraad
              </label>
              <select
                name="difficulty_level"
                defaultValue="beginner"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Gevorderd</option>
                <option value="advanced">Expert</option>
              </select>
            </div>
            <Input
              name="estimated_duration_minutes"
              label="Geschatte duur (minuten)"
              type="number"
              min={1}
              placeholder="Bijv. 120"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="budget_min_cents"
              label="Budget min (cent)"
              type="number"
              min={0}
              placeholder="Bijv. 1000"
            />
            <Input
              name="budget_max_cents"
              label="Budget max (cent)"
              type="number"
              min={0}
              placeholder="Bijv. 2500"
            />
          </div>
          <ImageUploadField
            name="featured_image_file"
            label="Hoofdafbeelding"
            hint="De afbeelding die bij je project in overzichten verschijnt (optioneel)."
          />
          <input type="hidden" name="currency_code" value="EUR" />
          <div className="flex flex-wrap gap-3 pt-4">
            <Button type="submit">Project aanmaken</Button>
            <Button type="button" variant="secondary" asChild>
              <Link href="/profile/projects">Annuleren</Link>
            </Button>
          </div>
        </form>
      </CardShell>
    </PageLayout>
  );
}
