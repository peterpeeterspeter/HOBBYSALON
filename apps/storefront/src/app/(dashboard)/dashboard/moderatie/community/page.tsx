import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { createPlatformClient } from "@/lib/platform/client";
import { isModerator } from "@/lib/platform/queries/community-showcase";
import { moderateArticleCommunityProjectAction } from "@/app/actions/community-showcase";
import { CardShell } from "@/components/ui/card-shell";
import { Button } from "@/components/ui/button";

export default async function CommunityModerationPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/dashboard/moderatie/community");
  if (!(await isModerator(user.id))) redirect("/dashboard");
  const supabase = createPlatformClient();
  const { data } = await supabase.from("article_project_showcase_submissions").select("id, article_id, project_id, created_at, projects(title, slug, featured_image_url), articles(title, slug)").eq("status", "pending").order("created_at", { ascending: true });
  const submissions = (data ?? []) as Array<{ id: string; article_id: string; project_id: string; created_at: string; projects: Array<{ title: string; slug: string; featured_image_url: string | null }>; articles: Array<{ title: string; slug: string }> }>;
  return <section className="space-y-6"><header><p className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">Moderatie</p><h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Communityprojecten</h1></header>{submissions.length === 0 ? <CardShell variant="default" padding="lg"><p>Geen projecten wachten op beoordeling.</p></CardShell> : submissions.map((submission) => { const project = submission.projects[0]; const article = submission.articles[0]; return <CardShell key={submission.id} variant="default" padding="lg"><div className="grid gap-4 md:grid-cols-[180px_1fr]"><>{project?.featured_image_url && <img src={project.featured_image_url} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />}</><div><p className="text-sm text-[var(--muted)]">Voor artikel: {article?.title ?? submission.article_id}</p><h2 className="text-xl font-semibold text-[var(--foreground)]">{project?.title ?? submission.project_id}</h2><form action={moderateArticleCommunityProjectAction} className="mt-4 space-y-3"><input type="hidden" name="submission_id" value={submission.id} /><textarea name="moderation_note" rows={2} placeholder="Notitie voor intern gebruik (optioneel)" className="w-full rounded-lg border border-[var(--border)] p-3" /><div className="flex gap-3"><Button name="status" value="approved" type="submit">Goedkeuren</Button><Button name="status" value="rejected" type="submit" variant="secondary">Afwijzen</Button></div></form></div></div></CardShell>})}</section>;
}
