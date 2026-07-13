"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/types/platform";
import {
  submitArticleCommunityProjectAction,
  withdrawArticleCommunityProjectAction,
  type CommunitySubmissionActionState,
} from "@/app/actions/community-showcase";
import {
  getCommunitySubmissionStatusCopy,
  type CommunitySubmissionStatus,
} from "@/lib/content/community-submission-status";

type OwnerSubmission = {
  projectId: string;
  status: CommunitySubmissionStatus;
};

type Props = {
  articleId: string;
  projects: Project[];
  submissions: OwnerSubmission[];
};

const INITIAL_STATE: CommunitySubmissionActionState = { message: null, error: null };

function SubmissionFeedback({ message, error }: { message: string | null; error: string | null }) {
  if (!message && !error) return null;
  return (
    <p
      className={error ? "mt-3 text-sm font-medium text-red-700" : "mt-3 text-sm font-medium text-emerald-700"}
      role={error ? "alert" : "status"}
    >
      {error ?? message}
    </p>
  );
}

export function CommunityProjectSubmission({ articleId, projects, submissions }: Props) {
  const router = useRouter();
  const [submitState, submitAction, isSubmitting] = useActionState(
    submitArticleCommunityProjectAction,
    INITIAL_STATE
  );
  const [withdrawState, withdrawAction, isWithdrawing] = useActionState(
    withdrawArticleCommunityProjectAction,
    INITIAL_STATE
  );
  const submissionByProjectId = new Map(submissions.map((submission) => [submission.projectId, submission]));
  const projectsToSubmit = projects.filter((project) => {
    const status = submissionByProjectId.get(project.id)?.status;
    return status !== "pending" && status !== "approved";
  });

  useEffect(() => {
    if (submitState.message || withdrawState.message) router.refresh();
  }, [router, submitState.message, withdrawState.message]);

  if (projects.length === 0) return null;

  return (
    <aside className="mt-6 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-5">
      <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">Heb jij dit ook gemaakt?</h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Deel een eigen project ter beoordeling. We tonen het pas na jouw toestemming en onze goedkeuring.</p>

      {submissions.length > 0 && (
        <div className="mt-4 space-y-3" aria-label="Jouw inzendingen voor dit artikel">
          {submissions.map((submission) => {
            const project = projects.find((item) => item.id === submission.projectId);
            const status = getCommunitySubmissionStatusCopy(submission.status);
            return (
              <div key={submission.projectId} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                <p className="font-semibold text-[var(--foreground)]">{project?.title ?? "Jouw project"}</p>
                <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{status.label}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{status.detail}</p>
                {status.canWithdraw && (
                  <form action={withdrawAction} className="mt-3">
                    <input type="hidden" name="article_id" value={articleId} />
                    <input type="hidden" name="project_id" value={submission.projectId} />
                    <button type="submit" disabled={isWithdrawing} className="min-h-[var(--touch-target-min)] rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60">
                      {isWithdrawing ? "Bezig met intrekken…" : "Inzending intrekken"}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
      <SubmissionFeedback {...withdrawState} />

      {projectsToSubmit.length > 0 && (
        <form action={submitAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="article_id" value={articleId} />
          <label className="grid gap-1 text-sm font-semibold text-[var(--foreground)]">
            Kies je project
            <select name="project_id" required className="min-h-[var(--touch-target-min)] min-w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)]">
              <option value="">Kies een project…</option>
              {projectsToSubmit.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
          <button type="submit" disabled={isSubmitting} className="min-h-[var(--touch-target-min)] rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Bezig met indienen…" : "Ter beoordeling indienen"}</button>
        </form>
      )}
      <SubmissionFeedback {...submitState} />
    </aside>
  );
}
