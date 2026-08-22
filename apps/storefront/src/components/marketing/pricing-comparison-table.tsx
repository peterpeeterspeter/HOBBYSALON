import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { MarketingSectionHeader } from "./marketing-section-header";
import type { PricingComparisonRow } from "@/lib/pricing/public-pricing";

type PricingComparisonTableProps = {
  id?: string;
  title: string;
  description?: string;
  footnote?: string;
  rows: PricingComparisonRow[];
};

const COL_NOW = "Wat je nu krijgt";
const COL_EXPANSION = "Uitbreiding";
const COL_BENEFIT = "Wat levert dat op?";

function PricingComparisonTable({
  id = "vergelijking",
  title,
  description,
  footnote,
  rows,
}: PricingComparisonTableProps) {
  return (
    <Section spacing="lg" id={id} variant="alt">
      <Container>
        <MarketingSectionHeader title={title} description={description} />

        {/* Mobile / 55+: stacked cards — no horizontal scroll table */}
        <ul className="mt-10 space-y-8 md:hidden">
          {rows.map((row) => (
            <li
              key={row.audience}
              className="border-t border-[var(--border)] pt-6"
            >
              <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
                {row.audience}
              </h3>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm font-semibold text-[var(--accent)]">
                    {COL_NOW}
                  </dt>
                  <dd className="mt-1 text-base leading-relaxed text-[var(--muted)]">
                    {row.now}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-[var(--accent)]">
                    {COL_EXPANSION}
                  </dt>
                  <dd className="mt-1 text-base leading-relaxed text-[var(--muted)]">
                    {row.expansion}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-[var(--accent)]">
                    {COL_BENEFIT}
                  </dt>
                  <dd className="mt-1 text-base leading-relaxed text-[var(--muted)]">
                    {row.benefit}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        {/* Desktop table */}
        <div className="mt-10 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-[var(--border)]">
                <th
                  scope="col"
                  className="py-4 pr-4 font-[family-name:var(--font-heading)] text-base font-bold text-[var(--foreground)]"
                >
                  Type aanbieder
                </th>
                <th
                  scope="col"
                  className="py-4 pr-4 font-[family-name:var(--font-heading)] text-base font-bold text-[var(--foreground)]"
                >
                  {COL_NOW}
                </th>
                <th
                  scope="col"
                  className="py-4 pr-4 font-[family-name:var(--font-heading)] text-base font-bold text-[var(--foreground)]"
                >
                  {COL_EXPANSION}
                </th>
                <th
                  scope="col"
                  className="py-4 font-[family-name:var(--font-heading)] text-base font-bold text-[var(--foreground)]"
                >
                  {COL_BENEFIT}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.audience}
                  className="border-b border-[var(--border)] align-top"
                >
                  <th
                    scope="row"
                    className="py-5 pr-4 font-semibold text-[var(--foreground)]"
                  >
                    {row.audience}
                  </th>
                  <td className="py-5 pr-4 text-base leading-relaxed text-[var(--muted)]">
                    {row.now}
                  </td>
                  <td className="py-5 pr-4 text-base leading-relaxed text-[var(--muted)]">
                    {row.expansion}
                  </td>
                  <td className="py-5 text-base leading-relaxed text-[var(--muted)]">
                    {row.benefit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {footnote ? (
          <p className="mt-8 max-w-3xl text-base leading-relaxed text-[var(--muted)]">
            {footnote}
          </p>
        ) : null}
      </Container>
    </Section>
  );
}

export { PricingComparisonTable };
export type { PricingComparisonTableProps };
