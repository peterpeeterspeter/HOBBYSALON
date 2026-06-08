import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import {
  getProjectByIdForOwner,
  listProjectProductLinks,
  listProjectSoughtMaterials,
  listProjectGalleryImages,
} from "@/lib/platform/queries/projects";
import {
  listMaterialProductsForSelection,
  listProductsByIds,
} from "@/lib/platform/queries/products";
import {
  updateProjectAction,
  createProfileProjectProductLinkAction,
  deleteProfileProjectProductLinkAction,
  createProfileProjectSoughtMaterialAction,
  deleteProfileProjectSoughtMaterialAction,
  createProfileProjectGalleryImageAction,
  deleteProfileProjectGalleryImageAction,
} from "@/app/actions/profile-projects";
import { PageLayout } from "@/components/layout/page-layout";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return { title: "Project bewerken" };
  const project = await getProjectByIdForOwner(id, user.id);
  if (!project) return { title: "Project bewerken" };
  return {
    title: `${project.title} bewerken | Hobbysalon`,
    description: `Bewerk project ${project.title} en voeg materialen toe.`,
  };
}

export default async function ProfileProjectEditPage({ params, searchParams }: Props) {
  const { id: projectId } = await params;
  const { success, error } = await searchParams;
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/profile/projects/" + projectId + "/edit");
  }

  const [project, productLinks, soughtMaterials, galleryImages, materialOptions] =
    await Promise.all([
      getProjectByIdForOwner(projectId, user.id),
      listProjectProductLinks(projectId),
      listProjectSoughtMaterials(projectId),
      listProjectGalleryImages(projectId),
      listMaterialProductsForSelection({ limit: 200 }),
    ]);

  if (!project) notFound();

  const productIds = productLinks.map((l) => l.product_id);
  const linkedProducts = productIds.length > 0 ? await listProductsByIds(productIds) : [];
  const productLabelById = new Map(linkedProducts.map((p) => [p.id, p.title]));

  return (
    <PageLayout
      title={`Bewerken: ${project.title}`}
      description="Pas je project aan en beheer materialen en foto's."
    >
      <div className="space-y-6">
        {success && (
          <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <CardShell variant="default" padding="lg">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Projectgegevens</h2>
          <form action={updateProjectAction} encType="multipart/form-data" className="mt-4 space-y-4">
            <input type="hidden" name="project_id" value={project.id} />
            <Input name="title" label="Titel *" required defaultValue={project.title} />
            <Input name="slug" label="Slug" defaultValue={project.slug} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Korte beschrijving
              </label>
              <textarea
                name="short_description"
                rows={2}
                defaultValue={project.short_description ?? ""}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Uitgebreide beschrijving
              </label>
              <textarea
                name="description"
                rows={4}
                defaultValue={project.description ?? ""}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  Moeilijkheidsgraad
                </label>
                <select
                  name="difficulty_level"
                  defaultValue={project.difficulty_level}
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
                defaultValue={project.estimated_duration_minutes ?? ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="budget_min_cents"
                label="Budget min (cent)"
                type="number"
                min={0}
                defaultValue={project.budget_min_cents ?? ""}
              />
              <Input
                name="budget_max_cents"
                label="Budget max (cent)"
                type="number"
                min={0}
                defaultValue={project.budget_max_cents ?? ""}
              />
            </div>
            <ImageUploadField
              name="featured_image_file"
              label="Hoofdafbeelding"
              hint="Upload een nieuwe foto om de huidige te vervangen."
              currentUrl={project.featured_image_url}
            />
            <input type="hidden" name="currency_code" value={project.currency_code} />
            <Button type="submit">Opslaan</Button>
          </form>
        </CardShell>

        <CardShell variant="default" padding="lg">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Materialen</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Kies uit bestaande producten in de webshop of voeg toe als &quot;gezocht&quot; als het
            product niet beschikbaar is.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <form
              action={createProfileProjectProductLinkAction}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <input type="hidden" name="project_id" value={project.id} />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Bestaand materiaal koppelen
              </h3>
              <label className="mt-2 block text-xs font-medium text-[var(--muted)]">
                Product
              </label>
              <select
                name="product_id"
                required
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <option value="">Kies product...</option>
                {materialOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.title}
                  </option>
                ))}
              </select>
              <input type="hidden" name="link_type" value="material" />
              <input type="hidden" name="sort_order" value={productLinks.length} />
              <Button type="submit" variant="secondary" size="sm" className="mt-2">
                Koppelen
              </Button>
            </form>

            <form
              action={createProfileProjectSoughtMaterialAction}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <input type="hidden" name="project_id" value={project.id} />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Product niet gevonden? Voeg toe als gezocht
              </h3>
              <Input
                name="title"
                label="Naam materiaal"
                required
                placeholder="Bijv. Specifieke wol in kleur X"
              />
              <Input name="notes" label="Opmerkingen (optioneel)" placeholder="Extra info..." />
              <input type="hidden" name="sort_order" value={soughtMaterials.length} />
              <Button type="submit" variant="secondary" size="sm" className="mt-2">
                Toevoegen als gezocht
              </Button>
            </form>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Gekoppelde producten ({productLinks.length})
              </h3>
              {productLinks.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">Nog geen producten gekoppeld.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {productLinks.map((link) => (
                    <li
                      key={link.id}
                      className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <span className="text-[var(--foreground)]">
                        {productLabelById.get(link.product_id) ?? link.product_id}
                      </span>
                      <form action={deleteProfileProjectProductLinkAction}>
                        <input type="hidden" name="project_product_link_id" value={link.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Verwijderen
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Materialen gezocht ({soughtMaterials.length})
              </h3>
              {soughtMaterials.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Nog geen gezochte materialen.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {soughtMaterials.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <span className="text-[var(--foreground)]">
                        {m.title}
                        {m.notes ? ` (${m.notes})` : ""}
                      </span>
                      <form action={deleteProfileProjectSoughtMaterialAction}>
                        <input type="hidden" name="sought_material_id" value={m.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Verwijderen
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardShell>

        <CardShell variant="default" padding="lg">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Galerijfoto&apos;s</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Voeg foto&apos;s toe van je afgewerkte creatie.
          </p>

          <form
            action={createProfileProjectGalleryImageAction}
            encType="multipart/form-data"
            className="mt-4 max-w-md"
          >
            <input type="hidden" name="project_id" value={project.id} />
            <ImageUploadField name="image_file" label="Foto *" required />
            <Input name="alt_text" label="Alt tekst" />
            <input type="hidden" name="sort_order" value={galleryImages.length} />
            <Button type="submit" variant="secondary" size="sm" className="mt-2">
              Foto toevoegen
            </Button>
          </form>

          {galleryImages.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {galleryImages.map((img) => (
                <li
                  key={img.id}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <a
                    href={img.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[var(--foreground)] hover:underline"
                  >
                    {img.alt_text ?? img.image_url}
                  </a>
                  <form action={deleteProfileProjectGalleryImageAction}>
                    <input type="hidden" name="gallery_image_id" value={img.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Verwijderen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">Nog geen galerijfoto&apos;s.</p>
          )}
        </CardShell>

        <div className="flex gap-3">
          <Button variant="secondary" asChild>
            <Link href={`/project/${project.slug}`}>Bekijk project</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/profile/projects">Terug naar overzicht</Link>
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
