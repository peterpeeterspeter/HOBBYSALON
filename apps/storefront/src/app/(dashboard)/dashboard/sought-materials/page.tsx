import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
import { listAllSoughtMaterialsWithProjects } from "@/lib/platform/queries/projects";
import { CardShell } from "@/components/ui/card-shell";

export const metadata: Metadata = {
  title: "Producten gezocht | Hobbysalon",
  description: "Overzicht van materialen die gebruikers zoeken voor hun projecten.",
};

export default async function SoughtMaterialsPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/sought-materials");
  }

  const registrationContext = await getUserRegistrationContext(user.id);
  const hasMerchantRole = registrationContext.roles.includes("merchant");

  if (!hasMerchantRole) {
    redirect("/dashboard");
  }

  const materials = await listAllSoughtMaterialsWithProjects();

  const byTitle = new Map<string, { count: number; projectSlugs: string[] }>();
  for (const m of materials) {
    const key = m.title.trim().toLowerCase();
    const existing = byTitle.get(key) ?? { count: 0, projectSlugs: [] };
    existing.count += 1;
    if (m.project_slug && !existing.projectSlugs.includes(m.project_slug)) {
      existing.projectSlugs.push(m.project_slug);
    }
    byTitle.set(key, existing);
  }

  const aggregated = Array.from(byTitle.entries())
    .map(([title, { count, projectSlugs }]) => ({
      title: materials.find((m) => m.title.trim().toLowerCase() === title)?.title ?? title,
      count,
      projectSlugs,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">
        Producten gezocht
      </h1>
      <p className="text-[var(--muted)]">
        Materialen die gebruikers toevoegen aan hun projecten wanneer het product niet in de
        webshop staat. Handig om assortiment uit te breiden.
      </p>

      <CardShell variant="default" padding="lg">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          Totaal: {materials.length} gezochte materialen
        </h2>
        {materials.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Nog geen producten gezocht door gebruikers.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
              Geaggregeerd per materiaal (gesorteerd op populariteit)
            </h3>
            <ul className="space-y-2">
              {aggregated.map((item, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
                >
                  <span className="font-medium text-[var(--foreground)]">{item.title}</span>
                  <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                    {item.count}x gezocht
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {item.projectSlugs.slice(0, 3).map((slug) => (
                      <Link
                        key={slug}
                        href={`/project/${slug}`}
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        /project/{slug}
                      </Link>
                    ))}
                    {item.projectSlugs.length > 3 && (
                      <span className="text-xs text-[var(--muted)]">
                        +{item.projectSlugs.length - 3} meer
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardShell>

      {materials.length > 0 && (
        <CardShell variant="default" padding="lg">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Volledige lijst (per project)
          </h2>
          <ul className="mt-4 space-y-2">
            {materials.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              >
                <span className="text-[var(--foreground)]">{m.title}</span>
                {m.notes && (
                  <span className="text-[var(--muted)]">– {m.notes}</span>
                )}
                {m.project_slug ? (
                  <Link
                    href={`/project/${m.project_slug}`}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    {m.project_title ?? m.project_slug}
                  </Link>
                ) : (
                  <span className="text-xs text-[var(--muted)]">-</span>
                )}
              </li>
            ))}
          </ul>
        </CardShell>
      )}
    </section>
  );
}
