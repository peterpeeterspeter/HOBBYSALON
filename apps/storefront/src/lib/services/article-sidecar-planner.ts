import "server-only";
import { createPlatformClient } from "../platform/client";
import { createStorageSidecarReader } from "../content/article-metadata-sidecar";
import { ARTICLE_SIDECAR_RELEASE, loadArticleSidecarPlanner } from "../content/article-sidecar-matching";
import type { ArticleSuggestionPlanner } from "../content/article-catalog-pipeline";

// Only immutable, pinned extraction data is cached. Article text and catalog/reviews
// are read afresh for each request. A failed download never poisons this cache.
let planner: Promise<ArticleSuggestionPlanner> | undefined;
export function getArticleSidecarPlanner(): Promise<ArticleSuggestionPlanner> {
  if (!planner) {
    planner = (async () => {
      const bucket = createPlatformClient().storage.from(ARTICLE_SIDECAR_RELEASE.bucket);
      return loadArticleSidecarPlanner(createStorageSidecarReader(path => bucket.download(path),ARTICLE_SIDECAR_RELEASE.prefix));
    })().catch(error => { planner = undefined; throw error; });
  }
  return planner;
}
