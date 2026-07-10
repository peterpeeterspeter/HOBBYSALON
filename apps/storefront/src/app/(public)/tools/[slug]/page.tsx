import { notFound } from "next/navigation";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { RelatedTools } from "@/components/tools/RelatedTools";
import { buildPageMetadata } from "@/lib/seo";
import { getToolBySlug, getRelatedTools } from "@/lib/tools/registry";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Tool niet gevonden | Hobbysalon" };
  return buildPageMetadata({
    title: `${tool.title} | Hobbysalon`,
    description: tool.description,
    path: `/tools/${slug}`,
  });
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const ToolComponent = tool.component;
  const relatedTools = getRelatedTools(slug);

  return (
    <ToolLayout
      title={tool.title}
      description={tool.description}
      categoryLabel={tool.categoryLabel}
    >
      <ToolComponent />
      <RelatedTools tools={relatedTools} categoryLabel={tool.categoryLabel} />
    </ToolLayout>
  );
}
