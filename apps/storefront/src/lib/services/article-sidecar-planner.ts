import "server-only";
import { createPlatformClient } from "../platform/client";
import { createStorageSidecarReader } from "../content/article-metadata-sidecar";
import { ARTICLE_SIDECAR_RELEASE, loadArticleSidecarPlanner } from "../content/article-sidecar-matching";
import { listStoredArticleMetadata } from "../content/article-metadata-store";
import type { ArticleSuggestionPlanner } from "../content/article-catalog-pipeline";

// Extraction data is cached per server instance. Article text and catalog/reviews
// are read afresh for each request. A failed download never poisons this cache.
let planner: Promise<ArticleSuggestionPlanner> | undefined;
export function getArticleSidecarPlanner(): Promise<ArticleSuggestionPlanner> {
  if (!planner) {
    planner = (async () => {
      const client = createPlatformClient();
      const bucket = client.storage.from(ARTICLE_SIDECAR_RELEASE.bucket);
      // Prefer public.article_metadata; the bucket file may be republished in place.
      return loadArticleSidecarPlanner(
        createStorageSidecarReader(path => bucket.download(path),ARTICLE_SIDECAR_RELEASE.prefix),
        ARTICLE_SIDECAR_RELEASE.manifestSha256,
        async () => {
          const stored = await listStoredArticleMetadata(client).catch(() => [] as unknown[]);
          return stored.length ? stored : undefined;
        },
      );
    })().catch(error => { planner = undefined; throw error; });
  }
  return planner;
}
