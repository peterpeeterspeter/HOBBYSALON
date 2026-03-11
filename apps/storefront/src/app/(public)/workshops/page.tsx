import { Suspense } from "react";
import Link from "next/link";
import { listAllWorkshops } from "@/lib/platform/queries/workshops";
import { createPlatformClient } from "@/lib/platform/client";
import { WorkshopCard } from "@/components/shared/WorkshopCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workshops | Hobbysalon",
  description: "Ontdek en boek workshops voor je hobby",
};

type SearchParams = Promise<{
  domain?: string;
  difficulty?: string;
  format?: string;
}>;

async function getDomains() {
  const supabase = createPlatformClient();
  const { data } = await supabase
    .from("domains")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as Array<{ id: string; name: string; slug: string }>;
}

async function WorkshopsContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const workshops = await listAllWorkshops({
    domain_id: params.domain,
    difficulty_level: params.difficulty,
    format_type: params.format,
  });
  const domains = await getDomains();

  const formatTypeOptions = [
    { value: "physical", label: "Fysiek" },
    { value: "online", label: "Online" },
    { value: "hybrid", label: "Hybride" },
  ];

  const difficultyOptions = [
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Gevorderd" },
    { value: "advanced", label: "Expert" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
          Workshops
        </h1>
        <p className="text-lg text-[var(--muted)]">
          Leer nieuwe technieken van ervaren instructeurs
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="font-semibold text-[var(--foreground)]">Filters</h2>
        <form method="GET" action="/workshops" className="grid gap-4 sm:grid-cols-4">
          {/* Domain Filter */}
          <div>
            <label htmlFor="domain" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Domein
            </label>
            <select
              id="domain"
              name="domain"
              defaultValue={params.domain ?? ""}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">Alle domeinen</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Format Filter */}
          <div>
            <label htmlFor="format" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Format
            </label>
            <select
              id="format"
              name="format"
              defaultValue={params.format ?? ""}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">Alle formats</option>
              {formatTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Niveau
            </label>
            <select
              id="difficulty"
              name="difficulty"
              defaultValue={params.difficulty ?? ""}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="">Alle niveaus</option>
              {difficultyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Button */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--accent)] px-6 py-2 font-semibold text-[var(--accent-foreground)] hover:opacity-90"
            >
              Filteren
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {workshops.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--muted)] mb-4">
            Geen workshops gevonden met deze filters.
          </p>
          <Link
            href="/workshops"
            className="inline-flex rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] hover:opacity-90"
          >
            Alle workshops bekijken
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-[var(--muted)]">
            {workshops.length} workshop{workshops.length !== 1 ? "s" : ""} gevonden
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workshops.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkshopsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="text-center py-12">Laden...</div>}>
      <WorkshopsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
