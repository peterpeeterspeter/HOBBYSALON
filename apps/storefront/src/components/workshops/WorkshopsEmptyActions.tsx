import Link from "next/link";

type WorkshopsEmptyActionsProps = {
  broaderPlaceHref?: string | null;
  belgiumHref: string;
  agendaHref?: string;
  hasPlaceFilter: boolean;
  hasAnyResults: boolean;
};

export function WorkshopsEmptyActions({
  broaderPlaceHref,
  belgiumHref,
  agendaHref = "/agenda",
  hasPlaceFilter,
  hasAnyResults,
}: WorkshopsEmptyActionsProps) {
  return (
    <div className="mt-8 flex flex-col gap-6">
      {!hasAnyResults ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            Geen workshops gevonden
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
            Probeer een andere plaats of datum, of bekijk alle komende workshops.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {hasPlaceFilter && broaderPlaceHref ? (
              <Link
                href={broaderPlaceHref}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] px-5 text-[15px] font-semibold hover:border-[var(--accent)]"
              >
                Toon meer plaatsen
              </Link>
            ) : null}
            <Link
              href={belgiumHref}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-[15px] font-bold text-[var(--accent-foreground)]"
            >
              Bekijk heel België
            </Link>
          </div>
        </div>
      ) : null}

      {hasAnyResults && hasPlaceFilter ? (
        <div className="flex flex-wrap gap-2">
          {broaderPlaceHref ? (
            <Link
              href={broaderPlaceHref}
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-semibold hover:border-[var(--accent)]"
            >
              Toon meer plaatsen
            </Link>
          ) : null}
          <Link
            href={belgiumHref}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[15px] font-semibold hover:border-[var(--accent)]"
          >
            Bekijk heel België
          </Link>
        </div>
      ) : null}

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--section-highlight)] p-5 sm:p-6">
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
          Liever eropuit?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
          Ontdek markten, beurzen en open ateliers bij jou in de buurt.
        </p>
        <Link
          href={agendaHref}
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 font-bold text-[var(--accent-foreground)]"
        >
          Bekijk creatieve events
        </Link>
      </div>
    </div>
  );
}
