import {
  approveArticleSuggestionAction,
  createArticleAction,
  dismissArticleSuggestionAction,
  purchaseSpotlightBoostFormAction,
  updateArticleAction,
} from "@/app/actions/dashboard";
import Link from "next/link";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { MultiImageUploadField } from "@/components/ui/multi-image-upload-field";
import { LISTING_CREDIT_COSTS } from "@/lib/platform/listing-credit-costs";
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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long" }).format(new Date(iso));
}

/** Where the articles of this author appear. */
function VisibilityNotice({ canPublishToHub }: { canPublishToHub: boolean }) {
  return canPublishToHub ? (
    <div className="mt-4 rounded-lg border border-[var(--accent)] bg-[var(--section-highlight)] p-4">
      <p className="text-base font-semibold text-[var(--foreground)]">
        Je artikels verschijnen in Inspiratie en in de zoekresultaten
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Als workshopgever of winkel voeg je een hoofdfoto, tot 8 extra foto&apos;s en een video
        toe. Een gepubliceerd artikel kun je uitlichten, dan staat het 7 dagen bovenaan Inspiratie.
      </p>
    </div>
  ) : (
    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--section-alt)] p-4">
      <p className="text-base font-semibold text-[var(--foreground)]">
        Je artikels verschijnen op je profiel
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Bezoekers lezen ze op je profielpagina en via de link die je deelt. Ze staan niet in het
        overzicht Inspiratie. Geef je workshops of heb je een winkel? Dan komen je artikels ook in
        het overzicht, met foto&apos;s, video en uitlichten.{" "}
        <Link href="/dashboard/instellingen" className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline">
          Pas aan wat je aanbiedt
        </Link>
        .
      </p>
    </div>
  );
}

/** Photos and video. Gallery and video only for hub authors. */
function ArticleMediaFields({
  creatorId,
  canPublishToHub,
  article,
}: {
  creatorId: string;
  canPublishToHub: boolean;
  article?: CreatorArticlesTabProps["articles"][number];
}) {
  const gallery = article?.gallery ?? [];
  return (
    <div className="grid gap-4 rounded-lg border border-[var(--border)] p-4 sm:col-span-2">
      <ImageUploadField
        name="featured_image_file"
        label="Hoofdfoto"
        uploadPathPrefix={`creators/${creatorId}/articles`}
        urlDefaultValue={article?.featured_image_url ?? undefined}
        hint={
          canPublishToHub
            ? "Liggend werkt het best · min. 1200×800 px. Deze foto staat bovenaan je artikel en op de kaart in het overzicht."
            : "Liggend werkt het best · min. 1200×800 px. Deze foto staat bovenaan je artikel."
        }
      />
      {canPublishToHub ? (
        <>
          {gallery.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-medium text-[var(--foreground)]">
                Foto&apos;s in dit artikel
              </legend>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Vink een foto aan om ze te verwijderen.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {gallery.map((image) => (
                  <label key={image.id} className="block cursor-pointer">
                    <img src={image.image_url} alt="" className="aspect-square w-full rounded-md object-cover" />
                    <span className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input type="checkbox" name="remove_gallery_image_ids" value={image.id} />
                      Verwijderen
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <MultiImageUploadField
            uploadPathPrefix={`creators/${creatorId}/articles/gallery`}
            label="Extra foto's"
            existingCount={gallery.length}
            hint="Tot 8 foto's: stappen, details of het resultaat."
          />
          <Input
            name="video_url"
            label="Video (YouTube of Vimeo)"
            type="url"
            defaultValue={article?.video_url ?? ""}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="-mt-2 text-xs text-[var(--muted)]">
            Plak de link van je video. Die verschijnt als speler in je artikel.
          </p>
        </>
      ) : null}
    </div>
  );
}

export function CreatorArticlesTab({
  creatorId,
  canPublishToHub,
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
      <VisibilityNotice canPublishToHub={canPublishToHub} />

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
        <ArticleMediaFields creatorId={creatorId} canPublishToHub={canPublishToHub} />
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
                    ({article.is_published ? "gepubliceerd" : "concept"}
                    {article.is_published
                      ? article.listing_scope === "hub"
                        ? " · in Inspiratie"
                        : " · op je profiel"
                      : ""}
                    {article.promotedUntil ? ` · uitgelicht tot ${formatDate(article.promotedUntil)}` : ""})
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
                  <ArticleMediaFields
                    creatorId={creatorId}
                    canPublishToHub={canPublishToHub}
                    article={article}
                  />
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

                {canPublishToHub && article.is_published && article.listing_scope === "hub" ? (
                  <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--section-alt)] p-3">
                    {article.promotedUntil ? (
                      <p className="text-sm text-[var(--foreground)]">
                        Dit artikel staat bovenaan Inspiratie tot {formatDate(article.promotedUntil)}.
                      </p>
                    ) : (
                      <form action={purchaseSpotlightBoostFormAction} className="flex flex-wrap items-center gap-3">
                        <input type="hidden" name="entity_type" value="article" />
                        <input type="hidden" name="entity_id" value={article.id} />
                        <input type="hidden" name="boost_type" value="spotlight" />
                        <p className="text-sm text-[var(--foreground)]">
                          Zet dit artikel 7 dagen bovenaan Inspiratie.
                        </p>
                        <Button type="submit" size="sm" variant="secondary">
                          Uitlichten voor {LISTING_CREDIT_COSTS.spotlight7Days} tegoed
                        </Button>
                      </form>
                    )}
                  </div>
                ) : null}

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
