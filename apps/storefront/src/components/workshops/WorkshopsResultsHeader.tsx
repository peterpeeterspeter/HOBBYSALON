type WorkshopsResultsHeaderProps = {
  title: string;
  totalCount: number;
  controlsSlot?: React.ReactNode;
};

export function WorkshopsResultsHeader({
  title,
  totalCount,
  controlsSlot,
}: WorkshopsResultsHeaderProps) {
  const label =
    totalCount === 1 ? "1 workshop" : `${totalCount} workshops`;

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
          {title}
        </h2>
        <p className="mt-0.5 text-[15px] text-[var(--muted)]">
          {label} · op datum gesorteerd
        </p>
      </div>
      {controlsSlot ? (
        <div className="flex flex-wrap items-center gap-2">{controlsSlot}</div>
      ) : null}
    </div>
  );
}
