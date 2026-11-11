/**
 * Who may publish articles to the overviews (/artikelen, /patronen, search),
 * and how article videos are embedded. The database trigger
 * `articles_set_listing_scope` applies the same rule; this copy drives the UI.
 */

export const HUB_ARTICLE_CREATOR_TYPES = ["workshopgever", "supplier"] as const;

export type ArticleAuthor = {
  creator_types?: string[] | null;
  editorial_publisher?: boolean | null;
};

/** True for workshop hosts, shops and the editorial team. */
export function canPublishArticlesToHub(author: ArticleAuthor | null | undefined): boolean {
  if (!author) return false;
  if (author.editorial_publisher) return true;
  return (author.creator_types ?? []).some((type) =>
    (HUB_ARTICLE_CREATOR_TYPES as readonly string[]).includes(type)
  );
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

/**
 * Turns a YouTube or Vimeo link into an embed URL. Returns null for any other
 * link, so only these two players are ever embedded.
 */
export function toVideoEmbedUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    const id = segments[0];
    return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  if (host === "youtube.com") {
    let id: string | null = null;
    if (segments[0] === "watch") id = url.searchParams.get("v");
    else if (["shorts", "embed", "live"].includes(segments[0] ?? "")) id = segments[1] ?? null;
    return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  if (host === "vimeo.com") {
    const id = segments[0];
    return id && VIMEO_ID.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }

  if (host === "player.vimeo.com" && segments[0] === "video") {
    const id = segments[1];
    return id && VIMEO_ID.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }

  return null;
}
