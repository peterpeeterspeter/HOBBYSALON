import { notFound } from "next/navigation";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { buildPageMetadata } from "@/lib/seo";
import { getToolBySlug } from "@/lib/tools/registry";

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

  return (
    <ToolLayout title={tool.title} description={tool.description}>
      <ToolComponent />
    </ToolLayout>
  );
}
