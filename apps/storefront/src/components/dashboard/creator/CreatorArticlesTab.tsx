import {
  approveArticleSuggestionAction,
  createArticleAction,
  dismissArticleSuggestionAction,
  updateArticleAction,
} from "@/app/actions/dashboard";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ARTICLE_TYPE_OPTIONS,
  RELATION_TYPE_LABELS,
  type CreatorArticlesTabProps,
} from "./types";

const TARGET_TYPE_LABELS: Record<string, string> = {
  product: "Product",
  workshop: "Workshop",
  event: "Event",
};

export function CreatorArticlesTab({
  domains,
  articles,
  articleSuggestionsByArticle,
  articleConfirmedByArticle,
  productLabels,
  workshopLabels,
  eventLabels,
}: CreatorArticlesTabProps) {
  function resolveTargetLabel(
    type: "product" | "workshop" | "event",
    id: string
  ): string {
    const map =
      type === "product"
        ? productLabels
        : type === "workshop"
          ? workshopLabels
          : eventLabels;
    return map.get(id) ?? id;
  }

  return (
    <CardShell variant="default" padding="lg">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">Artikels</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Schrijf tutorials, gidsen en patronen. We stellen koppelingen voor naar
        materialen, workshops en events; je makerprofiel verschijnt automatisch bij je content.
      </p>

      <form
        action={createArticleAction}
        className="mt-4 grid gap-3 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-2"
      >
        <Input name="title" label="Titel *" required placeholder="Bijv. Amigurumi voor beginners" />
        <div>
          <Input name="slug" label="Webadres (optioneel)" placeholder="Wordt automatisch gegenereerd" />
        </div>
        <label className="text-sm font-medium text-[var(--foreground)]">
          Type
          <select
            name="article_type"
            defaultValue="tutorial"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          >
            {ARTICLE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[var(--foreground)]">
          Hobby
          <select
            name="domain_id"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          >
            <option value="">Geen hobby gekozen</option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </select>
        </label>
        <Input name="excerpt" label="Korte intro" className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Inhoud
          </label>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Je kunt eenvoudige opmaak gebruiken (koppen, lijsten, links).
          </p>
          <textarea
            name="body_markdown"
            rows={6}
            placeholder="Schrijf je artikel hier..."
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)]"
          />
        </div>
        <label className="inline-flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="is_published" defaultChecked />
          <span className="text-sm">Direct publiceren</span>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            Artikel opslaan
          </Button>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {articles.length === 0 ? (
          <EmptyState
            compact
            title="Nog geen artikels"
            description="Deel je kennis en inspiratie met andere hobbyisten. Gebruik het formulier hierboven om je eerste artikel te schrijven."
            className="border border-dashed border-[var(--border)] rounded-lg"
          />
        ) : (
          articles.map((article) => {
            const suggestions = articleSuggestionsByArticle.get(article.id) ?? [];
            const confirmed = articleConfirmedByArticle.get(article.id) ?? [];
            return (
              <details
                key={article.id}
                className="rounded-lg border border-[var(--border)] p-3"
              >
                <summary className="cursor-pointer list-none font-medium text-[var(--foreground)]">
                  {article.title}{" "}
                  <span className="text-xs text-[var(--muted)]">
                    ({article.is_published ? "gepubliceerd" : "concept"})
                  </span>
                </summary>

                <form action={updateArticleAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={article.id} />
                  <Input name="title" label="Titel *" required defaultValue={article.title} />
                  <Input name="slug" label="Webadres" defaultValue={article.slug} />
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    Type
                    <select
                      name="article_type"
                      defaultValue={article.article_type}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                    >
                      {ARTICLE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    Hobby
                    <select
                      name="domain_id"
                      defaultValue={article.domain_id ?? ""}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                    >
                      <option value="">Geen hobby gekozen</option>
                      {domains.map((domain) => (
                        <option key={domain.id} value={domain.id}>
                          {domain.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    name="excerpt"
                    label="Korte intro"
                    defaultValue={article.excerpt ?? ""}
                    className="sm:col-span-2"
                  />
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-[var(--foreground)]">
                      Inhoud
                    </label>
                    <textarea
                      name="body_markdown"
                      rows={6}
                      defaultValue={article.body_markdown ?? ""}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)]"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      name="is_published"
                      defaultChecked={article.is_published}
                    />
                    <span className="text-sm">Publiceren</span>
                  </label>
                  <div className="sm:col-span-2">
                    <Button type="submit" variant="secondary" size="sm">
                      Artikel bijwerken
                    </Button>
                  </div>
                </form>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    Voorgestelde koppelingen ({suggestions.length})
                  </h3>
                  {suggestions.length === 0 ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Geen open suggesties voor dit artikel.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {suggestions.map((link) => {
                        const targetLabel = resolveTargetLabel(
                          link.target_entity_type,
                          link.target_entity_id
                        );
                        return (
                          <div
                            key={link.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            <p className="text-[var(--foreground)]">
                              {TARGET_TYPE_LABELS[link.target_entity_type]}: {targetLabel}
                            </p>
                            <div className="flex gap-2">
                              <form action={approveArticleSuggestionAction}>
                                <input type="hidden" name="entity_link_id" value={link.id} />
                                <input type="hidden" name="relation_type" value="related" />
                                <Button type="submit" size="sm" variant="secondary">
                                  Bevestigen
                                </Button>
                              </form>
                              <form action={dismissArticleSuggestionAction}>
                                <input type="hidden" name="entity_link_id" value={link.id} />
                                <Button type="submit" size="sm" variant="ghost">
                                  Negeren
                                </Button>
                              </form>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    Bevestigde koppelingen ({confirmed.length})
                  </h3>
                  {confirmed.length === 0 ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Nog geen bevestigde koppelingen.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                      {confirmed.map((link) => {
                        const targetLabel = resolveTargetLabel(
                          link.target_entity_type,
                          link.target_entity_id
                        );
                        return (
                          <p key={link.id}>
                            {TARGET_TYPE_LABELS[link.target_entity_type]}: {targetLabel}
                            {" · "}
                            {RELATION_TYPE_LABELS[link.relation_type] ?? link.relation_type}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              </details>
            );
          })
        )}
      </div>
    </CardShell>
  );
}
