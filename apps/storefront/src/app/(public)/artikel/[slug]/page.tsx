import { notFound } from "next/navigation";
import Link from "next/link";
import { createPlatformClient } from "@/lib/platform/client";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

async function getArticleBySlug(slug: string) {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();
  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Niet gevonden" };
  return {
    title: (article as { seo_title?: string }).seo_title ?? `${(article as { title: string }).title} | Hobbysalon`,
    description: (article as { seo_description?: string }).seo_description ?? (article as { excerpt?: string }).excerpt ?? undefined,
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const a = article as {
    title: string;
    excerpt?: string;
    body_markdown?: string;
    featured_image_url?: string;
    article_type?: string;
    reading_time_minutes?: number;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">Home</Link>
          </li>
          <li>/</li>
          <li className="text-[var(--foreground)]">{a.title}</li>
        </ol>
      </nav>

      <article>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">{a.title}</h1>
        {a.excerpt && (
          <p className="mt-4 text-lg text-[var(--muted)]">{a.excerpt}</p>
        )}
        {a.reading_time_minutes && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {a.reading_time_minutes} min lezen
          </p>
        )}
        {a.featured_image_url && (
          <div className="mt-6 aspect-video overflow-hidden rounded-lg">
            <img
              src={a.featured_image_url}
              alt={a.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        {a.body_markdown && (
          <div className="mt-8 whitespace-pre-wrap text-[var(--foreground)]">
            {a.body_markdown}
          </div>
        )}
      </article>
    </div>
  );
}
