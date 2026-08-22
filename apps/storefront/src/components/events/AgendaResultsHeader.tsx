type AgendaResultsHeaderProps = {
  totalCount: number;
  filtersSlot?: React.ReactNode;
};

export function AgendaResultsHeader({
  totalCount,
  filtersSlot,
}: AgendaResultsHeaderProps) {
  const label =
    totalCount === 1 ? "1 event" : `${totalCount} events`;

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
          Binnenkort
        </h2>
        <p className="mt-0.5 text-[15px] text-[var(--muted)]">
          {label} · op datum gesorteerd
        </p>
      </div>
      {filtersSlot ? <div className="shrink-0">{filtersSlot}</div> : null}
    </div>
  );
}
