import {
  createProjectGalleryImageAction,
  createProjectProductLinkAction,
  createProjectSoughtMaterialAction,
  deleteProjectGalleryImageAction,
  deleteProjectProductLinkAction,
  deleteProjectSoughtMaterialAction,
} from "@/app/actions/dashboard";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { CreatorPortfolioTabProps } from "./types";

export function CreatorPortfolioTab({
  projects,
  projectImagesByProject,
  projectLinksByProject,
  projectSoughtMaterialsByProject,
  materialProductOptions,
  ownProductLabels,
}: CreatorPortfolioTabProps) {
  const projectProductLabelMap = new Map([
    ...ownProductLabels.entries(),
    ...materialProductOptions.map((o) => [o.id, o.label] as const),
  ]);

  return (
    <CardShell variant="default" padding="lg">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">Portfolio</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Toon je afgewerkte creaties op je maker-pagina. Voeg foto&apos;s toe en koppel de
        materialen die je gebruikte.
      </p>

      {projects.length === 0 ? (
        <EmptyState
          title="Nog geen projecten"
          description="Deel je afgewerkte creaties op je maker-pagina. Maak eerst een project aan, daarna kun je hier foto's en materialen toevoegen."
          action={{ label: "Nieuw project aanmaken", href: "/profile/projects/new" }}
          className="mt-4 border border-dashed border-[var(--border)] rounded-lg"
        />
      ) : (
        <div className="mt-4 space-y-4">
          {projects.map((project) => {
            const gallery = projectImagesByProject.get(project.id) ?? [];
            const linkedProducts = projectLinksByProject.get(project.id) ?? [];
            const soughtMaterials = projectSoughtMaterialsByProject.get(project.id) ?? [];
            return (
              <details key={project.id} className="rounded-lg border border-[var(--border)] p-3">
                <summary className="cursor-pointer list-none font-medium text-[var(--foreground)]">
                  {project.title}
                </summary>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Zichtbaar op hobbysalon.be/project/{project.slug}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <form
                    action={createProjectGalleryImageAction}
                    className="rounded-lg border border-[var(--border)] p-3"
                  >
                    <input type="hidden" name="project_id" value={project.id} />
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      Foto toevoegen
                    </h3>
                    <Input
                      name="image_url"
                      label="Foto-URL *"
                      required
                      placeholder="Plak een link naar je foto"
                    />
                    <Input name="alt_text" label="Beschrijving (optioneel)" />
                    <input type="hidden" name="sort_order" value={0} />
                    <Button type="submit" variant="secondary" size="sm" className="mt-2">
                      Foto toevoegen
                    </Button>
                  </form>

                  <form
                    action={createProjectProductLinkAction}
                    className="rounded-lg border border-[var(--border)] p-3"
                  >
                    <input type="hidden" name="project_id" value={project.id} />
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      Materiaal uit webshop
                    </h3>
                    <label className="mt-2 block text-xs font-medium text-[var(--muted)]">
                      Product
                    </label>
                    <select
                      name="product_id"
                      required
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                    >
                      <option value="">Kies een product...</option>
                      {materialProductOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input type="hidden" name="link_type" value="material" />
                    <input type="hidden" name="sort_order" value={linkedProducts.length} />
                    <Button type="submit" variant="secondary" size="sm" className="mt-2">
                      Koppelen
                    </Button>
                  </form>

                  <form
                    action={createProjectSoughtMaterialAction}
                    className="rounded-lg border border-[var(--border)] p-3"
                  >
                    <input type="hidden" name="project_id" value={project.id} />
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      Materiaal niet gevonden?
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Voeg toe als gezocht product.
                    </p>
                    <Input name="title" label="Naam materiaal *" required />
                    <Input name="notes" label="Opmerkingen" />
                    <input type="hidden" name="sort_order" value={soughtMaterials.length} />
                    <Button type="submit" variant="secondary" size="sm" className="mt-2">
                      Toevoegen als gezocht
                    </Button>
                  </form>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    Foto&apos;s ({gallery.length})
                  </h3>
                  {gallery.length === 0 ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Nog geen foto&apos;s. Voeg hierboven je eerste foto toe.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {gallery.map((image) => (
                        <div
                          key={image.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                        >
                          <a
                            href={image.image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-[var(--foreground)] hover:underline"
                          >
                            {image.alt_text ?? image.image_url}
                          </a>
                          <form action={deleteProjectGalleryImageAction}>
                            <input type="hidden" name="gallery_image_id" value={image.id} />
                            <Button type="submit" size="sm" variant="ghost">
                              Verwijderen
                            </Button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      Gebruikte materialen ({linkedProducts.length})
                    </h3>
                    {linkedProducts.length === 0 ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Nog geen gekoppelde producten.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {linkedProducts.map((link) => (
                          <div
                            key={link.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            <p className="text-[var(--foreground)]">
                              {projectProductLabelMap.get(link.product_id) ?? link.product_id}
                            </p>
                            <form action={deleteProjectProductLinkAction}>
                              <input
                                type="hidden"
                                name="project_product_link_id"
                                value={link.id}
                              />
                              <Button type="submit" size="sm" variant="ghost">
                                Verwijderen
                              </Button>
                            </form>
                          </div>
                        ))}
                      </div>
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
                      <div className="mt-2 space-y-2">
                        {soughtMaterials.map((m) => (
                          <div
                            key={m.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            <p className="text-[var(--foreground)]">
                              {m.title}
                              {m.notes ? ` (${m.notes})` : ""}
                            </p>
                            <form action={deleteProjectSoughtMaterialAction}>
                              <input type="hidden" name="sought_material_id" value={m.id} />
                              <Button type="submit" size="sm" variant="ghost">
                                Verwijderen
                              </Button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}
